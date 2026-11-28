import { describe, expect, it } from 'vitest';

import type { SearchRequest } from '../src/lib/pdf/document-search';
import type { PdfObjectRecord } from '../src/lib/pdf/types';

import { runDocumentSearch } from '../src/lib/pdf/document-search';

const NOTICE = 'Showing the first 500 matches. Narrow your search.';

const request = (scope: string, overrides: Partial<SearchRequest>): SearchRequest => {
  return {
    bytes: new Uint8Array(),
    document: null,
    isCurrent: () => {
      return true;
    },
    objectMap: new Map(),
    objects: [],
    password: undefined,
    readStream: async () => {
      throw new Error('not used');
    },
    scope,
    signal: new AbortController().signal,
    term: 'x',
    ...overrides,
  };
};

const fonts = (count: number) => {
  return Array.from({ length: count }, (_, index) => {
    return { id: `${index + 1} 0`, kind: 'Font', label: 'Font', objectNumber: index + 1 } as PdfObjectRecord;
  });
};

describe('search result limit', () => {
  it.each([
    ['objects', 500, ''],
    ['objects', 501, NOTICE],
  ])('%s search with %i matches', async (scope, count, message) => {
    const outcome = await runDocumentSearch(request(scope, { objects: fonts(count), term: 'font' }));
    expect(outcome?.found).toHaveLength(500);
    expect(outcome?.message).toBe(message);
  });
  it.each([
    [500, ''],
    [501, NOTICE],
  ])('byte search with %i matches', async (count, message) => {
    const outcome = await runDocumentSearch(request('text', { bytes: new TextEncoder().encode('x'.repeat(count)) }));
    expect(outcome?.found).toHaveLength(500);
    expect(outcome?.message).toBe(message);
  });
  it.each([
    [500, ''],
    [501, NOTICE],
  ])('decoded search with %i matching streams', async (count, message) => {
    const streams = fonts(count).map((object) => {
      return { ...object, stream: { filters: [], length: 1 } };
    });
    const outcome = await runDocumentSearch(
      request('decoded', {
        objects: streams,
        readStream: async (objectId) => {
          return { bytes: new TextEncoder().encode('x'), mode: 'decoded', objectId, text: 'x', truncated: false };
        },
      })
    );
    expect(outcome?.found).toHaveLength(500);
    expect(outcome?.message).toBe(message);
  });
});
