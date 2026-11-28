import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchRequest } from '../src/lib/pdf/document-search';

const request = (): SearchRequest => {
  return {
    bytes: new Uint8Array([1]),
    document: { locked: false } as SearchRequest['document'],
    isCurrent: () => {
      return true;
    },
    objectMap: new Map(),
    objects: [],
    password: undefined,
    readStream: async () => {
      throw new Error('not used');
    },
    scope: 'pageText',
    signal: new AbortController().signal,
    term: 'term',
  };
};

/** Mocks the page-text search module so that importing it takes `loadMs`, and returns the search it provides. */
const mockModule = (loadMs: number) => {
  const searchPageText = vi.fn(async () => {
    return { hits: [], limited: false, pages: new Map() };
  });
  vi.doMock('../src/lib/pdf/page-text-search', async () => {
    await new Promise((resolve) => {
      // setTimeout treats an infinite delay as 1 ms, so a stalled load never schedules one.
      if (Number.isFinite(loadMs)) {
        setTimeout(resolve, loadMs);
      }
    });
    return { searchPageText };
  });
  return searchPageText;
};

describe('page text search code loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.doUnmock('../src/lib/pdf/page-text-search');
    vi.useRealTimers();
  });
  it('gives up with the engine message when the code does not load within 2 minutes', async () => {
    const search = mockModule(Number.POSITIVE_INFINITY);
    const { runDocumentSearch } = await import('../src/lib/pdf/document-search');
    const result = expect(runDocumentSearch(request())).rejects.toThrow(
      'The page text engine did not load within 2 minutes. Check your connection and search again.'
    );
    await vi.advanceTimersByTimeAsync(120_000);
    await result;
    expect(search).not.toHaveBeenCalled();
  });
  it('counts the time spent loading the code towards the engine limit', async () => {
    const search = mockModule(60_000);
    const { runDocumentSearch } = await import('../src/lib/pdf/document-search');
    const started = Date.now();
    const result = runDocumentSearch(request());
    await vi.advanceTimersByTimeAsync(60_000);
    await result;
    expect(search).toHaveBeenCalledWith(expect.any(Uint8Array), 'term', undefined, expect.any(AbortSignal), started + 120_000);
  });
  it('stops waiting for the code when the search is cancelled', async () => {
    mockModule(Number.POSITIVE_INFINITY);
    const { runDocumentSearch } = await import('../src/lib/pdf/document-search');
    const controller = new AbortController();
    const result = expect(runDocumentSearch({ ...request(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
  });
  it('blames the engine when the code fails to load', async () => {
    vi.doMock('../src/lib/pdf/page-text-search', async () => {
      throw new Error('chunk failed');
    });
    const { runDocumentSearch } = await import('../src/lib/pdf/document-search');
    await expect(runDocumentSearch(request())).rejects.toThrow(
      'The page text engine could not load. Check your connection and search again.'
    );
  });
});
