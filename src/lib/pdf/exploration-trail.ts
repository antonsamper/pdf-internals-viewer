import type { PdfObjectRecord, PdfValue } from "./types"

/** A visited route through the PDF graph, never a claim of unique ownership. */
export interface ExplorationStep {
  id: string | null
  label: string
}

export function extendExplorationTrail(
  trail: ExplorationStep[],
  source: ExplorationStep,
  target: ExplorationStep,
  path: string[] = [],
  owners?: (string | null)[]
): ExplorationStep[] {
  const prefix = trail.length ? trail : [source]
  return [
    ...prefix,
    ...path.map((label, index) => ({
      id: owners?.[index] ?? source.id,
      label,
    })),
    target,
  ]
}

/** Associate each path segment with the object that actually contains its key. */
export function referencePathOwners(
  value: PdfValue,
  path: string[],
  objects: Map<string, PdfObjectRecord>,
  sourceId: string | null
): (string | null)[] {
  let current: PdfValue | undefined = value
  let owner = sourceId
  return path.map((segment) => {
    const seen = new Set<string>()
    while (current?.type === "reference" && !seen.has(current.ref)) {
      seen.add(current.ref)
      owner = current.ref
      current = objects.get(current.ref)?.value
    }
    const segmentOwner = owner
    if (current?.type === "dictionary" || current?.type === "stream") {
      current = current.entries.find(
        (entry) => entry.key.replace(/^\//, "") === segment.replace(/^\//, "")
      )?.value
    } else if (current?.type === "array") {
      current = current.items[Number(segment.replace(/^\[|\]$/g, ""))]
    } else {
      current = undefined
    }
    return segmentOwner
  })
}
