import type { PdfObjectRecord, PdfValue } from './types';

import { property } from './navigation';
/** Summarize effective clockwise page rotations, including inherited /Rotate. */
export const pageRotationSummary = (pages: string[], objects: Map<string, PdfObjectRecord>): string => {
  const resolve = (value: PdfValue | undefined): PdfValue | undefined => {
    const seen = new Set<string>();
    while (value?.type === 'reference') {
      if (seen.has(value.ref)) return undefined;
      seen.add(value.ref);
      value = objects.get(value.ref)?.value;
    }
    return value;
  };
  const rotation = (id: string): number | null => {
    const chain = new Set<string>();
    let result: number | null = null;
    while (!chain.has(id)) {
      if (cache.has(id)) {
        result = cache.get(id)!;
        break;
      }
      chain.add(id);
      const object = objects.get(id);
      if (!object || object.value.type !== 'dictionary') break;
      const stored = property(object.value, 'Rotate');
      const value = resolve(stored);
      if (stored && value?.type !== 'null') {
        if (value?.type === 'number' && Number.isSafeInteger(value.value) && value.value % 90 === 0)
          result = ((value.value % 360) + 360) % 360;
        break;
      }
      const parent = property(object.value, 'Parent');
      if (!parent || parent.type === 'null') {
        result = 0;
        break;
      }
      if (parent.type !== 'reference') break;
      id = parent.ref;
    }
    for (const ancestor of chain) cache.set(ancestor, result);
    return result;
  };
  if (!pages.length) return 'Not available';
  const cache = new Map<string, number | null>();
  const rotations = new Set(pages.map(rotation));
  const angles = [...rotations]
    .filter((angle): angle is number => angle !== null)
    .toSorted((a, b) => a - b)
    .map((angle) => `${angle}°`);
  if (rotations.has(null)) angles.push('Unknown');
  return angles.length === 1 ? angles[0] : `Mixed (${angles.join(', ')})`;
};
