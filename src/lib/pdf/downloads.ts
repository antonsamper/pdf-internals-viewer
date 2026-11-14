import { property } from "./navigation"
import type { PdfObjectRecord, PdfValue } from "./types"

export interface EmbeddedDownload {
  streamId: string
  filename: string
  kind: "attachment" | "font"
  subset: boolean
}

/** PDF names are untrusted filenames, never paths. */
export function downloadFilename(value: string, fallback: string): string {
  const leaf = value.split(/[\\/]/).pop() ?? ""
  const clean = leaf
    // Strip control characters supplied by the document's filename.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*\u202a-\u202e\u2066-\u2069]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 180)
  return clean || fallback
}

export function embeddedDownloads(objects: Map<string, PdfObjectRecord>) {
  const index = new Map<string, EmbeddedDownload[]>()
  const resolve = (value: PdfValue | undefined): PdfValue | undefined => {
    const seen = new Set<string>()
    while (value?.type === "reference") {
      if (seen.has(value.ref) || seen.size >= 16) return undefined
      seen.add(value.ref)
      value = objects.get(value.ref)?.value
    }
    return value
  }
  const text = (value: PdfValue | undefined) => {
    const resolved = resolve(value)
    return resolved?.type === "name" || resolved?.type === "string"
      ? resolved.value
      : undefined
  }
  const add = (id: string, asset: EmbeddedDownload) => {
    const list = index.get(id) ?? []
    if (
      !list.some(
        (item) =>
          item.streamId === asset.streamId &&
          item.filename === asset.filename &&
          item.kind === asset.kind
      )
    )
      list.push(asset)
    index.set(id, list)
  }
  for (const object of objects.values()) {
    // Direct file specifications may live inside name trees, annotations, or /AF arrays.
    let remaining = 5_000
    const scanAttachments = (value: PdfValue, depth: number) => {
      if (remaining-- <= 0 || depth > 32) return
      const ef = resolve(property(value, "EF"))
      if (ef?.type === "dictionary") {
        const filename =
          text(property(value, "UF")) || text(property(value, "F"))
        // Prefer the Unicode filename's stream; retain alternative embedded streams.
        const entries = [...ef.entries].sort(
          (a, b) => Number(b.key === "UF") - Number(a.key === "UF")
        )
        const seen = new Set<string>()
        for (const entry of entries) {
          if (entry.value.type !== "reference" || seen.has(entry.value.ref))
            continue
          const stream = objects.get(entry.value.ref)
          if (!stream?.stream) continue
          seen.add(stream.id)
          const asset: EmbeddedDownload = {
            streamId: stream.id,
            kind: "attachment",
            subset: false,
            filename: downloadFilename(
              filename ?? "",
              `attachment-${stream.id.replace(/ /g, "-")}.bin`
            ),
          }
          add(object.id, asset)
          add(stream.id, asset)
        }
      }
      if (value.type === "array") {
        for (const child of value.items) {
          if (remaining <= 0) break
          scanAttachments(child, depth + 1)
        }
      } else if (value.type === "dictionary" || value.type === "stream") {
        for (const entry of value.entries) {
          if (remaining <= 0) break
          scanAttachments(entry.value, depth + 1)
        }
      }
      // Indirect dictionaries are scanned separately as indexed objects.
    }
    scanAttachments(object.value, 0)
    const walkFont = (
      input: PdfValue | undefined,
      fontName: string | undefined,
      seen: Set<PdfValue>
    ) => {
      const value = resolve(input)
      if (!value || seen.has(value) || seen.size >= 32) return
      seen.add(value)
      const name =
        text(property(value, "FontName")) ||
        text(property(value, "BaseFont")) ||
        fontName
      for (const key of ["FontFile", "FontFile2", "FontFile3"]) {
        const ref = property(value, key)
        if (ref?.type !== "reference") continue
        const stream = objects.get(ref.ref)
        if (!stream?.stream) continue
        const subtype = text(property(stream.value, "Subtype"))
        const extension =
          key === "FontFile2"
            ? "ttf"
            : key === "FontFile"
              ? "type1"
              : subtype === "OpenType"
                ? "otf"
                : subtype === "Type1C" || subtype === "CIDFontType0C"
                  ? "cff"
                  : "bin"
        const asset: EmbeddedDownload = {
          streamId: stream.id,
          kind: "font",
          subset: /^[A-Z]{6}\+/.test(name ?? ""),
          filename: `${downloadFilename(name ?? "", `font-${stream.id.replace(/ /g, "-")}`)}.${extension}`,
        }
        add(object.id, asset)
        add(stream.id, asset)
      }
      walkFont(property(value, "FontDescriptor"), name, seen)
      const descendants = resolve(property(value, "DescendantFonts"))
      if (descendants?.type === "array")
        for (const child of descendants.items) walkFont(child, name, seen)
    }
    walkFont(object.value, undefined, new Set())
  }
  for (const object of objects.values()) {
    if (
      object.stream &&
      text(property(object.value, "Type")) === "EmbeddedFile" &&
      !index.get(object.id)?.some((item) => item.kind === "attachment")
    ) {
      add(object.id, {
        streamId: object.id,
        kind: "attachment",
        subset: false,
        filename: `attachment-${object.id.replace(/ /g, "-")}.bin`,
      })
    }
  }
  return index
}
