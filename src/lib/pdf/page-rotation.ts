import type { PdfObjectRecord, PdfValue } from './types';

import { resolveValue } from './content-stream';
import { property } from './navigation';
/** Summarize effective clockwise page rotations, including inherited /Rotate. */
export const pageRotationSummary = (pages: string[], objects: Map<string, PdfObjectRecord>): string => {
  const rotation = (id: string): number | null => {
    const chain = new Set<string>();
    let result: number | null = null;
    while (!chain.has(id)) {
      if (cache.has(id)) {
        result = cache.get(id)!;
        break;
      }
      chain.add(id);
      const step = rotationStep(objects.get(id), objects);
      if ('angle' in step) {
        result = step.angle;
        break;
      }
      id = step.parent;
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
/** One node's answer: its angle (null when unknown), or the parent it inherits from. */
const rotationStep = (
  object: PdfObjectRecord | undefined,
  objects: Map<string, PdfObjectRecord>
): { angle: number | null } | { parent: string } => {
  if (!object || object.value.type !== 'dictionary') return { angle: null };
  const stored = property(object.value, 'Rotate');
  const value = resolveValue(stored, objects);
  if (stored && value?.type !== 'null') return { angle: rotationAngle(value) };
  const parent = property(object.value, 'Parent');
  if (!parent || parent.type === 'null') return { angle: 0 };
  return parent.type === 'reference' ? { parent: parent.ref } : { angle: null };
};
const rotationAngle = (value: PdfValue | undefined): number | null =>
  value?.type === 'number' && Number.isSafeInteger(value.value) && value.value % 90 === 0 ? ((value.value % 360) + 360) % 360 : null;
