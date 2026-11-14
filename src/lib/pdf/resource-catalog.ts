import { embeddedDownloads, type EmbeddedDownload } from "./downloads"
import { resourceKind } from "./resource-tools"
import type { PdfObjectRecord } from "./types"

export type ResourceCategory = "All" | "Font" | "Attachment" | "Image" | "Form"
export interface ResourceEntry {
  object: PdfObjectRecord
  kind: Exclude<ResourceCategory, "All">
  downloads: EmbeddedDownload[]
}

/** A single attachment row per embedded stream and filename, preferring its file specification. */
export function resourceCatalog(
  objects: Map<string, PdfObjectRecord>
): ResourceEntry[] {
  const downloads = embeddedDownloads(objects)
  const entries: ResourceEntry[] = []
  for (const object of objects.values()) {
    const kind = resourceKind(object)
    if (kind)
      entries.push({
        object,
        kind,
        downloads: (downloads.get(object.id) ?? []).filter(
          (asset) => asset.kind === "font"
        ),
      })
  }
  const seen = new Set<string>()
  const attachments = [...downloads.entries()].filter(([, assets]) =>
    assets.some((asset) => asset.kind === "attachment")
  )
  // A named file specification is more helpful than its bare stream.
  attachments.sort(
    ([a], [b]) =>
      Number(Boolean(objects.get(a)?.stream)) -
      Number(Boolean(objects.get(b)?.stream))
  )
  for (const [id, assets] of attachments) {
    const object = objects.get(id)
    if (!object) continue
    const unique = assets.filter((asset) => {
      if (asset.kind !== "attachment") return false
      const key = `${asset.streamId}:${asset.filename}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (unique.length)
      entries.push({ object, kind: "Attachment", downloads: unique })
  }
  return entries
}
