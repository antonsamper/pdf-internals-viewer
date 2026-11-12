import { effectiveResources, hasSubtype, property } from "./navigation"
import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from "./types"

export function resourceKind(
  object: PdfObjectRecord
): "Font" | "Image" | "Form" | undefined {
  const type = property(object.value, "Type")
  if (
    object.kind === "Font" ||
    (type?.type === "name" && type.value === "Font")
  )
    return "Font"
  if (hasSubtype(object, "Image")) return "Image"
  if (hasSubtype(object, "Form")) return "Form"
}

/** Pages exposing a resource, not proof that a drawing operator uses it. */
export function resourcePageAccess(
  document: PdfDocumentInfo,
  objects: Map<string, PdfObjectRecord>
) {
  const pages = new Map<string, number[]>()
  let remaining = 100_000
  let incomplete = false
  document.pages.forEach((id, index) => {
    const page = objects.get(id)
    const root = page && effectiveResources(page, objects)
    if (!root) return
    const seen = new Set<string>()
    const visit = (value: PdfValue, depth: number) => {
      if (remaining-- <= 0 || depth > 32) {
        incomplete = true
        return
      }
      if (value.type === "reference") {
        if (seen.has(value.ref)) return
        seen.add(value.ref)
        const object = objects.get(value.ref)
        if (!object) {
          incomplete = true
          return
        }
        if (resourceKind(object))
          pages.set(value.ref, [...(pages.get(value.ref) ?? []), index + 1])
        visit(object.value, depth + 1)
      } else if (value.type === "array") {
        for (const child of value.items) {
          if (remaining <= 0) {
            incomplete = true
            break
          }
          visit(child, depth + 1)
        }
      } else if (value.type === "dictionary" || value.type === "stream") {
        for (const entry of value.entries) {
          if (remaining <= 0) {
            incomplete = true
            break
          }
          // Parent points out of resource scope and could traverse the whole page tree.
          if (entry.key.replace(/^\//, "") !== "Parent")
            visit(entry.value, depth + 1)
        }
      }
    }
    visit(root.value, 0)
  })
  return { pages, incomplete }
}

function semanticValue(value: PdfValue): unknown {
  switch (value.type) {
    case "dictionary":
    case "stream":
      return [
        value.type,
        value.entries
          .map(({ key, value }) => [key, semanticValue(value)])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ]
    case "array":
      return [value.type, value.items.map(semanticValue)]
    case "reference":
      return [value.type, value.ref]
    case "null":
      return [value.type]
    default:
      return [value.type, value.value]
  }
}
export function samePdfValue(left: PdfValue, right: PdfValue): boolean {
  return (
    JSON.stringify(semanticValue(left)) === JSON.stringify(semanticValue(right))
  )
}
export interface ComparisonRow {
  key: string
  left?: PdfValue
  right?: PdfValue
  status: "same" | "added" | "removed" | "changed"
}
export function compareObjects(
  left: PdfObjectRecord,
  right: PdfObjectRecord
): ComparisonRow[] {
  const entries = (value: PdfValue) =>
    value.type === "dictionary" || value.type === "stream"
      ? value.entries
      : [{ key: "Value", value }]
  const index = (value: PdfValue) => {
    const seen = new Map<string, number>()
    return new Map(
      entries(value).map(({ key, value }) => {
        const count = (seen.get(key) ?? 0) + 1
        seen.set(key, count)
        return [
          `${key}${count > 1 ? ` (occurrence ${count})` : ""}`,
          value,
        ] as const
      })
    )
  }
  const l = index(left.value),
    r = index(right.value)
  return [...new Set([...l.keys(), ...r.keys()])].map((key) => {
    const a = l.get(key),
      b = r.get(key)
    return {
      key,
      left: a,
      right: b,
      status: !a
        ? "added"
        : !b
          ? "removed"
          : samePdfValue(a, b)
            ? "same"
            : "changed",
    }
  })
}

export type ImagePlan = { width: number; height: number; channels: 1 | 3 }
/** Fail closed on masks, nonstandard decoding and color spaces requiring interpretation. */
export function imagePlan(object: PdfObjectRecord): ImagePlan {
  if (!hasSubtype(object, "Image"))
    throw new Error("This object is not an image XObject.")
  const number = (key: string) => {
    const value = property(object.value, key)
    return value?.type === "number" ? value.value : NaN
  }
  const width = number("Width"),
    height = number("Height")
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 4096 ||
    height > 4096 ||
    width * height > 4_000_000
  )
    throw new Error(
      "Thumbnail unavailable: image dimensions exceed the 4 megapixel / 4096 pixel safety limit or are invalid."
    )
  if (
    ["Decode", "ImageMask", "Mask", "SMask", "SMaskInData"].some(
      (key) => property(object.value, key) !== undefined
    )
  )
    throw new Error(
      "Thumbnail unavailable: custom decoding or image masks require a full renderer. Inspect the dictionary and stream instead."
    )
  const space = property(object.value, "ColorSpace")
  if (
    space?.type !== "name" ||
    !["DeviceRGB", "DeviceGray"].includes(space.value) ||
    number("BitsPerComponent") !== 8
  )
    throw new Error(
      "Thumbnail unavailable: only 8-bit DeviceRGB and DeviceGray images are supported here. Inspect the dictionary and stream instead."
    )
  return { width, height, channels: space.value === "DeviceRGB" ? 3 : 1 }
}
export function imageRgba(
  plan: ImagePlan,
  bytes: Uint8Array
): Uint8ClampedArray {
  const expected = plan.width * plan.height * plan.channels
  if (bytes.length !== expected)
    throw new Error(
      "Thumbnail unavailable: decoded sample length does not match the image dimensions."
    )
  const rgba = new Uint8ClampedArray(plan.width * plan.height * 4)
  for (let i = 0, p = 0; i < bytes.length; i += plan.channels, p += 4) {
    rgba[p] = bytes[i]
    rgba[p + 1] = bytes[i + (plan.channels === 3 ? 1 : 0)]
    rgba[p + 2] = bytes[i + (plan.channels === 3 ? 2 : 0)]
    rgba[p + 3] = 255
  }
  return rgba
}
