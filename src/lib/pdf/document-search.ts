import type { PageTextLocation, PageTextSourceList } from '@/lib/pdf/page-text';
import type { PageTextHit } from '@/lib/pdf/page-text-search';
import type { SearchSnippet } from '@/lib/pdf/search-snippet';
import type { PdfDocumentInfo, PdfObjectRecord, PdfValue, StreamResult } from '@/lib/pdf/types';

import { ENGINE_LOAD_FAILED, ENGINE_LOAD_SLOW, withTimeout } from '@/lib/pdf/engine-load';
import { ENGINE_LOAD_TIMEOUT_MS } from '@/lib/pdf/limits';
import { pageTextSourceList } from '@/lib/pdf/page-text';
import { byteSearchSnippet } from '@/lib/pdf/search-snippet';

export type SearchResult = {
  label: string;
  detail: string;
  snippet?: SearchSnippet;
  id?: string;
  range?: { start: number; end: number };
  pageText?: PageTextLocation;
};

export interface SearchRequest {
  bytes: Uint8Array;
  document: PdfDocumentInfo | null;
  objectMap: Map<string, PdfObjectRecord>;
  objects: PdfObjectRecord[];
  password: string | undefined;
  scope: string;
  signal: AbortSignal;
  term: string;
  /** False once the search was cancelled or replaced by a newer one. */
  isCurrent: () => boolean;
  /** Page-text search only: true while its engine loads, then false once the search itself starts. */
  onEngineLoading?: (loading: boolean) => void;
  readStream: (id: string, mode: 'raw' | 'decoded') => Promise<StreamResult>;
}

/** Results plus an explanatory note; null when the search stopped being current. */
export type SearchOutcome = { found: SearchResult[]; message: string } | null;

const MAX_RESULTS = 500;

const pageTextResult = (
  hit: PageTextHit,
  pageId: string,
  pageNumber: number,
  { contentsLimited, limited, sources }: PageTextSourceList
): SearchResult => {
  return {
    detail: `${hit.count} text match${hit.count === 1 ? '' : 'es'}`,
    label: `Page ${pageNumber}`,
    pageText: {
      contentsLimited,
      count: hit.count,
      matches: hit.matches,
      pageId,
      pageNumber,
      snippet: hit.snippet,
      sources,
      sourcesLimited: limited,
    },
    snippet: hit.context ?? {
      after: '',
      before: '',
      match: hit.snippet,
    },
  };
};

/**
 * Scopes collect one result past MAX_RESULTS, so a search with exactly MAX_RESULTS matches is not reported as cut off.
 * Each result is one match.
 */
const capResults = (found: SearchResult[]) => {
  const limited = found.length > MAX_RESULTS;

  return { found: found.slice(0, MAX_RESULTS), notice: limited ? `Showing the first ${MAX_RESULTS} matches. Narrow your search.` : '' };
};

/** Page-text results are pages, and the search stops at MAX_RESULTS text matches rather than pages. */
const pageTextNote = (limited: boolean, pages: number) => {
  return `${limited ? `Showing ${pages} page${pages === 1 ? '' : 's'} for the first ${MAX_RESULTS} text matches. ` : ''}Results are grouped by page. Source locations cover supported fonts and direct page streams; candidate streams are labelled. Scans without a text layer need OCR.`;
};

/** The page-text search code is fetched on first use, so loading it counts towards the engine loading limit. */
const loadPageTextSearch = async (signal: AbortSignal, deadline: number) => {
  let timedOut = false;

  try {
    const stopped = new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          return reject(signal.reason);
        },
        { once: true }
      );
    });
    const module = await withTimeout(
      Promise.race([import('@/lib/pdf/page-text-search'), stopped]),
      deadline - Date.now(),
      ENGINE_LOAD_SLOW,
      () => {
        timedOut = true;
      }
    );

    return module.searchPageText;
  } catch (error) {
    signal.throwIfAborted();
    throw timedOut ? error : new Error(ENGINE_LOAD_FAILED, { cause: error });
  }
};

const searchPageText = async (request: SearchRequest): Promise<SearchOutcome> => {
  const { bytes, document, isCurrent, objectMap, objects, onEngineLoading, password, readStream, signal, term } = request;

  if (!document || document.locked) {
    throw new Error('Unlock the PDF before searching page text.');
  }

  const deadline = Date.now() + ENGINE_LOAD_TIMEOUT_MS;

  onEngineLoading?.(true);
  const runPageSearch = await loadPageTextSearch(signal, deadline);
  const pageSearch = await runPageSearch(bytes, term, password, signal, {
    deadline,
    onEngineReady: () => {
      return onEngineLoading?.(false);
    },
  });
  const streamCache = new Map<string, Promise<StreamResult>>();
  const cachedRead = (id: string) => {
    if (!streamCache.has(id)) {
      streamCache.set(id, readStream(id, 'decoded'));
    }

    return streamCache.get(id)!;
  };

  const found: SearchResult[] = [];

  for (const hit of pageSearch.hits) {
    if (!isCurrent()) {
      return null;
    }

    const page = objects.find((object) => {
      return object.objectNumber === hit.objectNumber && object.kind === 'Page';
    });

    if (!page) {
      continue;
    }

    // oxlint-disable-next-line react-doctor/async-await-in-loop -- sequential: every page reads streams through the shared cache and must stop as soon as the search is cancelled.
    const list = await pageTextSourceList(page, objectMap, term, cachedRead, document.encrypted, () => {
      return !isCurrent();
    });

    list.sources.sort((a, b) => {
      return Number(Boolean(b.ranges.length)) - Number(Boolean(a.ranges.length));
    });
    found.push(pageTextResult(hit, page.id, pageSearch.pages.get(hit.objectNumber) ?? document.pages.indexOf(page.id) + 1, list));
  }

  if (!isCurrent()) {
    return null;
  }

  return {
    found,
    message: pageTextNote(pageSearch.limited, found.length),
  };
};

const searchObjects = ({ objects, scope, term }: SearchRequest): SearchOutcome => {
  const needle = term.toLowerCase();
  const hasKey = (value: PdfValue): boolean => {
    if (value.type === 'dictionary' || value.type === 'stream') {
      return value.entries.some((entry) => {
        return entry.key.toLowerCase().includes(needle.replace(/^\//, '')) || hasKey(entry.value);
      });
    }

    return value.type === 'array' && value.items.some(hasKey);
  };

  const found: SearchResult[] = [];

  for (const object of objects) {
    const matches =
      scope === 'keys' ? hasKey(object.value) : `${object.id} ${object.id} R ${object.label} ${object.kind}`.toLowerCase().includes(needle);

    if (!matches) {
      continue;
    }

    found.push({
      detail: object.label,
      id: object.id,
      label: `${object.id} obj`,
    });
    if (found.length > MAX_RESULTS) {
      break;
    }
  }

  const { found: shown, notice } = capResults(found);

  return { found: shown, message: notice };
};

const searchDecoded = async ({ isCurrent, objects, readStream, term }: SearchRequest): Promise<SearchOutcome> => {
  const found: SearchResult[] = [];
  const lowered = term.toLowerCase();
  let skipped = 0;

  for (const object of objects.filter((candidate) => {
    return candidate.stream;
  })) {
    if (!isCurrent()) {
      return null;
    }

    try {
      // oxlint-disable-next-line react-doctor/async-await-in-loop -- sequential: streams are decoded one at a time so cancellation and the result limit apply immediately.
      const result = await readStream(object.id, 'decoded');

      if (result.error || result.truncated) {
        skipped++;
      }

      const at = result.text.toLowerCase().indexOf(lowered);

      if (at >= 0) {
        found.push({
          detail: 'Decoded stream text',
          id: object.id,
          label: `${object.id} obj`,
          snippet: byteSearchSnippet(result.bytes, at, at + term.length),
        });
      }
    } catch {
      skipped++;
    }

    if (found.length > MAX_RESULTS) {
      break;
    }
  }

  const partial = skipped ? `${skipped} stream(s) unsupported or incomplete. Results are partial.` : '';
  const { found: shown, notice } = capResults(found);

  return { found: shown, message: [notice, partial].filter(Boolean).join(' ') };
};

/** The bytes to find; throws when the term is not valid for the scope. */
const byteNeedle = (scope: string, term: string) => {
  const compact = term.replace(/\s/g, '');

  if (scope === 'hex' && (!/^[\da-f]+$/i.test(compact) || compact.length % 2)) {
    throw new Error('Enter complete hex bytes, for example 25 50 44 46.');
  }

  if (
    scope === 'text' &&
    [...term].some((character) => {
      return character.charCodeAt(0) > 255;
    })
  ) {
    throw new Error('Original byte-text search accepts Latin-1 characters (0–255). Use decoded search for stream content.');
  }

  return scope === 'hex'
    ? Uint8Array.from(compact.match(/../g) ?? [], (pair) => {
        return parseInt(pair, 16);
      })
    : Uint8Array.from(term, (character) => {
        return character.charCodeAt(0);
      });
};

/** Compares the rest of the needle once its first byte has matched. */
const matchesAt = (bytes: Uint8Array, needle: Uint8Array, offset: number) => {
  for (let index = 1; index < needle.length; index++) {
    if (bytes[offset + index] !== needle[index]) {
      return false;
    }
  }

  return true;
};

const byteResult = (bytes: Uint8Array, offset: number, length: number, hex: boolean): SearchResult => {
  return {
    detail: `${length} original file byte${length === 1 ? '' : 's'}`,
    label: `0x${offset.toString(16).toUpperCase()}`,
    range: { end: offset + length, start: offset },
    snippet: byteSearchSnippet(bytes, offset, offset + length, hex),
  };
};

const searchBytes = async ({ bytes, isCurrent, scope, term }: SearchRequest): Promise<SearchOutcome> => {
  const needle = byteNeedle(scope, term);
  const found: SearchResult[] = [];

  for (let offset = 0; offset <= bytes.length - needle.length; offset++) {
    if (offset % 100000 === 0) {
      // oxlint-disable-next-line react-doctor/async-await-in-loop -- yields to the event loop periodically so a long scan stays cancellable.
      await new Promise((resolve) => {
        return setTimeout(resolve, 0);
      });
      if (!isCurrent()) {
        return null;
      }
    }

    if (bytes[offset] !== needle[0] || !matchesAt(bytes, needle, offset)) {
      continue;
    }

    found.push(byteResult(bytes, offset, needle.length, scope === 'hex'));
    if (found.length > MAX_RESULTS) {
      break;
    }
  }

  const { found: shown, notice } = capResults(found);

  return { found: shown, message: notice };
};

/** Runs one document search; scope-specific validation errors are thrown. */
export const runDocumentSearch = (request: SearchRequest): Promise<SearchOutcome> | SearchOutcome => {
  switch (request.scope) {
    case 'pageText':
      return searchPageText(request);
    case 'objects':
    case 'keys':
      return searchObjects(request);
    case 'decoded':
      return searchDecoded(request);
    default:
      return searchBytes(request);
  }
};
