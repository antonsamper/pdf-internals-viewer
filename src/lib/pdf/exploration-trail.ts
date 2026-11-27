import type { PdfObjectRecord, PdfValue } from './types';
export const extendExplorationTrail = function extendExplorationTrail(
  trail: ExplorationStep[],
  source: ExplorationStep,
  target: ExplorationStep,
  path: string[] = [],
  owners?: (string | null)[]
): ExplorationStep[] {
  const prefix = trail.length ? trail : [source];
  return [
    ...prefix,
    ...path.map((label, index) => {
      return {
        id: owners?.[index] ?? source.id,
        label,
      };
    }),
    target,
  ];
};
/** Follow a chain of references to the value it ends at, and the object that holds it. */
const dereference = (value: PdfValue | undefined, owner: string | null, objects: Map<string, PdfObjectRecord>) => {
  let current = value;
  let currentOwner = owner;
  const seen = new Set<string>();
  while (current?.type === 'reference' && !seen.has(current.ref)) {
    seen.add(current.ref);
    currentOwner = current.ref;
    current = objects.get(current.ref)?.value;
  }
  return { owner: currentOwner, value: current };
};
const segmentValue = (value: PdfValue | undefined, segment: string): PdfValue | undefined => {
  if (value?.type === 'dictionary' || value?.type === 'stream') {
    return value.entries.find((entry) => {
      return entry.key.replace(/^\//, '') === segment.replace(/^\//, '');
    })?.value;
  }
  if (value?.type === 'array') {
    return value.items[Number(segment.replace(/^\[|\]$/g, ''))];
  }
  return undefined;
};
/** Associate each path segment with the object that actually contains its key. */
export const referencePathOwners = function referencePathOwners(
  value: PdfValue,
  path: string[],
  objects: Map<string, PdfObjectRecord>,
  sourceId: string | null
): (string | null)[] {
  let current: PdfValue | undefined = value;
  let owner = sourceId;
  return path.map((segment) => {
    const resolved = dereference(current, owner, objects);
    owner = resolved.owner;
    current = segmentValue(resolved.value, segment);
    return owner;
  });
};
/** A visited route through the PDF graph, never a claim of unique ownership. */
export interface ExplorationStep {
  id: string | null;
  label: string;
}
