import type { SearchMatch } from '@embedpdf/engine';

import { localEngine } from '@embedpdf/engine';

import type { SearchSnippet } from './search-snippet';

import { ENGINE_LOAD_TIMEOUT_MS, OPERATION_TIMEOUT_MS } from './limits';

const ENGINE_LOAD_FAILED = 'The page text engine could not load. Check your connection and search again.';
const ENGINE_LOAD_SLOW = `The page text engine did not load within ${ENGINE_LOAD_TIMEOUT_MS / 60_000} minutes. Check your connection and search again.`;
const SEARCH_TIMED_OUT = `Page text search exceeded ${OPERATION_TIMEOUT_MS / 1000} seconds. Try a smaller PDF or another search mode.`;

/** Settles with `request`, or rejects with `message` after `ms` and calls `onTimeout`. */
const withTimeout = async <T>(request: PromiseLike<T>, ms: number, message: string, onTimeout: () => void): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new Error(message));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** A blank one-page PDF with a valid cross-reference table. */
const blankPdf = () => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>',
  ];
  let text = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = text.length;
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((offset) => {
      return `${String(offset).padStart(10, '0')} 00000 n \n`;
    })
    .join('')}`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(text);
};

/**
 * Waits for the engine to download and start. The engine starts on its first request, so it opens a blank PDF; the
 * search's own time limit then covers only the user's file.
 */
const loadEngine = async (engine: ReturnType<typeof localEngine>, signal: AbortSignal, abort: () => void) => {
  let timedOut = false;
  const ready = engine.open({ bytes: blankPdf().buffer, kind: 'bytes' }).then((blank) => {
    return blank.close();
  });
  try {
    await withTimeout(ready, ENGINE_LOAD_TIMEOUT_MS, ENGINE_LOAD_SLOW, () => {
      timedOut = true;
      abort();
    });
  } catch (error) {
    signal.throwIfAborted();
    throw timedOut ? error : new Error(ENGINE_LOAD_FAILED, { cause: error });
  }
};

/** A short-lived local engine, terminated on cancellation or completion. */
export const searchPageText = async function searchPageText(
  bytes: Uint8Array,
  text: string,
  password: string | undefined,
  signal: AbortSignal
) {
  // A malformed file must not leave the search UI waiting on a stuck worker.
  const bounded = <T>(request: PromiseLike<T>) => {
    return withTimeout(request, OPERATION_TIMEOUT_MS, SEARCH_TIMED_OUT, abort);
  };
  const engine = localEngine();
  const abort = () => {
    void engine.destroy().catch(() => {
      return undefined;
    });
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    await loadEngine(engine, signal, abort);
    const document = await bounded(engine.open({ bytes: bytes.slice().buffer, kind: 'bytes' }, { password }));
    const listed = await bounded(document.pages.list());
    const pages = new Map(
      listed.pages.map((page, index) => {
        return [page.ref.objectNumber, index + 1];
      })
    );
    const hits = new Map<number, PageTextHit>();
    let cursor: string | undefined;
    let count = 0;
    do {
      signal.throwIfAborted();
      const batch = await bounded(
        document.search.query({
          cursor,
          limit: { matches: 500 - count, pages: 25 },
          matchDiacritics: true,
          snippets: true,
          text,
        })
      );
      for (const match of batch.matches) {
        const objectNumber = match.page.objectNumber;
        const prior = hits.get(objectNumber);
        if (prior) {
          prior.count++;
          prior.matches.push(match);
        } else {
          hits.set(objectNumber, {
            context: match.snippet,
            count: 1,
            matches: [match],
            objectNumber,
            snippet: match.snippet ? `${match.snippet.before}${match.snippet.match}${match.snippet.after}` : text,
          });
        }
        count++;
      }
      cursor = batch.nextCursor ?? undefined;
    } while (cursor && count < 500);
    signal.throwIfAborted();
    return { hits: [...hits.values()], limited: count >= 500, pages };
  } finally {
    signal.removeEventListener('abort', abort);
    await engine.destroy().catch(() => {
      return undefined;
    });
  }
};
export interface PageTextHit {
  objectNumber: number;
  count: number;
  snippet: string;
  context?: SearchSnippet;
  matches: SearchMatch[];
}
