import type { PdfObjectRecord, PdfValue } from "./types"

export function property(value: PdfValue, key: string): PdfValue | undefined {
  return value.type === "dictionary" || value.type === "stream"
    ? value.entries.find((entry) => entry.key.replace(/^\//, "") === key)?.value
    : undefined
}
export function effectiveResources(
  page: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>
): { value: PdfValue; inheritedFrom?: string } | undefined {
  const seen = new Set<string>()
  let current: PdfObjectRecord | undefined = page
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    const resources = property(current.value, "Resources")
    if (resources)
      return {
        value: resources,
        ...(current.id !== page.id ? { inheritedFrom: current.id } : {}),
      }
    const parent = property(current.value, "Parent")
    current = parent?.type === "reference" ? objects.get(parent.ref) : undefined
  }
}
export function hasSubtype(object: PdfObjectRecord, subtype: string): boolean {
  const value = property(object.value, "Subtype")
  return value?.type === "name" && value.value === subtype
}
