import { describe, expect, it } from 'vitest';

import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from '../src/lib/pdf/types';

import { compareObjects, imagePlan, imageRgba, resourcePageAccess, samePdfValue } from '../src/lib/pdf/resource-tools';
const name = (value: string): PdfValue => {
  return {
    text: `/${value}`,
    type: 'name',
    value,
  };
};

const number = (value: number): PdfValue => {
  return {
    text: String(value),
    type: 'number',
    value,
  };
};

const ref = (id: string): PdfValue => {
  return {
    ref: id,
    text: `${id} R`,
    type: 'reference',
  };
};

const dictionary = (entries: Record<string, PdfValue>): PdfValue => {
  return {
    entries: Object.entries(entries).map(([key, value]) => {
      return { key, value };
    }),
    text: '<< >>',
    type: 'dictionary',
  };
};

const object = (id: string, entries: Record<string, PdfValue>): PdfObjectRecord => {
  return {
    generation: 0,
    id,
    kind: 'Dictionary',
    label: id,
    objectNumber: 1,
    provenance: { reason: 'test', type: 'unknown' },
    referencedBy: [],
    references: [],
    source: '',
    value: dictionary(entries),
    warnings: [],
  };
};

const image = (changes: Record<string, PdfValue> = {}) => {
  return object('4 0', {
    BitsPerComponent: number(8),
    ColorSpace: name('DeviceRGB'),
    Height: number(1),
    Subtype: name('Image'),
    Width: number(2),
    ...changes,
  });
};

describe('object comparison', () => {
  it('compares semantic dictionary values regardless of key order while preserving types', () => {
    expect(samePdfValue(dictionary({ A: number(1), B: name('Hi') }), dictionary({ A: number(1), B: name('Hi') }))).toBe(true);
    expect(samePdfValue(name('Hi'), { text: '(Hi)', type: 'string', value: 'Hi' })).toBe(false);
    expect(
      compareObjects(object('1 0', { A: number(1), Gone: name('old') }), object('2 0', { A: number(2), New: name('new') })).map(
        ({ key, status }) => {
          return [key, status];
        }
      )
    ).toEqual([
      ['A', 'changed'],
      ['Gone', 'removed'],
      ['New', 'added'],
    ]);
  });
  it('retains duplicate key occurrences', () => {
    const left = object('1 0', { A: number(1) }),
      right = object('2 0', { A: number(1) });

    if (left.value.type === 'dictionary') {
      left.value.entries.push({ key: 'A', value: number(2) });
    }

    expect(
      compareObjects(left, right).map((row) => {
        return row.status;
      })
    ).toEqual(['same', 'removed']);
  });
});
describe('bounded image previews', () => {
  it('produces accurate RGB and gray samples', () => {
    expect([...imageRgba(imagePlan(image()), new Uint8Array([255, 0, 1, 2, 3, 4]))]).toEqual([255, 0, 1, 255, 2, 3, 4, 255]);
    expect([...imageRgba(imagePlan(image({ ColorSpace: name('DeviceGray') })), new Uint8Array([10, 20]))]).toEqual([
      10, 10, 10, 255, 20, 20, 20, 255,
    ]);
  });
  it('rejects masks, alternate decode, unsupported colors, oversized images and incomplete data before rendering', () => {
    for (const changes of [
      { Mask: ref('5 0') },
      { Decode: dictionary({}) },
      {
        ImageMask: { text: 'false', type: 'boolean', value: false } as PdfValue,
      },
      { ColorSpace: name('DeviceCMYK') },
      { Width: number(20_000) },
      { Height: number(3000), Width: number(3000) },
    ]) {
      expect(() => {
        return imagePlan(image(changes));
      }).toThrow();
    }

    expect(() => {
      return imageRgba(imagePlan(image()), new Uint8Array(2));
    }).toThrow(/length/);
  });
});
describe('resource page context', () => {
  it('follows inherited resources and nested forms without following Parent cycles', () => {
    const page = object('1 0', { Parent: ref('2 0') });
    const parent = object('2 0', { Resources: ref('3 0') });
    const resources = object('3 0', {
      XObject: dictionary({ Fm1: ref('4 0') }),
    });
    const form = object('4 0', {
      Parent: ref('1 0'),
      Resources: dictionary({
        XObject: dictionary({ Im1: ref('5 0'), Loop: ref('4 0') }),
      }),
      Subtype: name('Form'),
    });
    const img = image();

    img.id = '5 0';
    const objects = [page, parent, resources, form, img];
    const result = resourcePageAccess(
      { objects, pages: ['1 0'] } as PdfDocumentInfo,
      new Map(
        objects.map((record) => {
          return [record.id, record];
        })
      )
    );

    expect(result.pages.get('4 0')).toEqual([1]);
    expect(result.pages.get('5 0')).toEqual([1]);
    expect(result.incomplete).toBe(false);
  });
});
