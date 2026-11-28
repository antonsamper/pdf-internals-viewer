import type { SearchMatch } from '@embedpdf/engine';

import { localEngine, resolveDefaultWasmSource } from '@embedpdf/engine';

import type { SearchSnippet } from './search-snippet';

import { ENGINE_LOAD_FAILED, ENGINE_LOAD_SLOW, withTimeout } from './engine-load';
import { ENGINE_LOAD_TIMEOUT_MS, OPERATION_TIMEOUT_MS } from './limits';

const SEARCH_TIMED_OUT = `Page text search exceeded ${OPERATION_TIMEOUT_MS / 1000} seconds. Try a smaller PDF or another search mode.`;

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
 * Downloads the engine's wasm where the engine would, but with `signal`. The engine's own download can't be stopped:
 * destroying it waits for the download to finish first.
 */
const loadWasm = async (signal: AbortSignal) => {
  const source = await resolveDefaultWasmSource({});
  if (source.wasmBinary) {
    return source.wasmBinary;
  }
  const response = await fetch(source.wasmUrl!, { signal });
  if (!response.ok) {
    throw new Error(`The page text engine download failed with HTTP ${response.status}.`);
  }
  return response.arrayBuffer();
};

/**
 * Waits for the engine to download and start, until `deadline`. The engine starts on its first request, so it opens a
 * blank PDF; the search's own time limit then covers only the user's file.
 */
const loadEngine = async (engine: ReturnType<typeof localEngine>, signal: AbortSignal, abort: () => void, deadline: number) => {
  let timedOut = false;
  const ready = engine.open({ bytes: blankPdf().buffer, kind: 'bytes' }).then((blank) => {
    return blank.close();
  });
  try {
    await withTimeout(ready, Math.max(0, deadline - Date.now()), ENGINE_LOAD_SLOW, () => {
      timedOut = true;
      abort();
    });
  } catch (error) {
    signal.throwIfAborted();
    throw timedOut ? error : new Error(ENGINE_LOAD_FAILED, { cause: error });
  }
};

const MAX_MATCHES = 500;

const addMatch = (hits: Map<number, PageTextHit>, match: SearchMatch, text: string) => {
  const objectNumber = match.page.objectNumber;
  const prior = hits.get(objectNumber);
  if (prior) {
    prior.count++;
    prior.matches.push(match);
    return;
  }
  hits.set(objectNumber, {
    context: match.snippet,
    count: 1,
    matches: [match],
    objectNumber,
    snippet: match.snippet ? `${match.snippet.before}${match.snippet.match}${match.snippet.after}` : text,
  });
};

export interface EngineLoad {
  /** When the engine must have loaded. The caller sets it before importing this module, so the import counts too. */
  deadline?: number;
  /** Called once the engine has loaded and the search itself starts. */
  onEngineReady?: () => void;
}

/** A short-lived local engine, terminated on cancellation or completion. */
export const searchPageText = async function searchPageText(
  bytes: Uint8Array,
  text: string,
  password: string | undefined,
  signal: AbortSignal,
  { deadline = Date.now() + ENGINE_LOAD_TIMEOUT_MS, onEngineReady }: EngineLoad = {}
) {
  // A malformed file must not leave the search UI waiting on a stuck worker.
  const bounded = <T>(request: PromiseLike<T>) => {
    return withTimeout(request, OPERATION_TIMEOUT_MS, SEARCH_TIMED_OUT, abort);
  };
  const download = new AbortController();
  const engine = localEngine({
    wasmLoader: () => {
      return loadWasm(download.signal);
    },
  });
  const abort = () => {
    download.abort();
    void engine.destroy().catch(() => {
      return undefined;
    });
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    await loadEngine(engine, signal, abort, deadline);
    onEngineReady?.();
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
    let limited = false;
    do {
      signal.throwIfAborted();
      // One match past the cap shows whether the search was cut off or had exactly MAX_MATCHES matches.
      const batch = await bounded(
        document.search.query({
          cursor,
          limit: { matches: MAX_MATCHES + 1 - count, pages: 25 },
          matchDiacritics: true,
          snippets: true,
          text,
        })
      );
      for (const match of batch.matches) {
        if (count === MAX_MATCHES) {
          limited = true;
          break;
        }
        addMatch(hits, match, text);
        count++;
      }
      cursor = batch.nextCursor ?? undefined;
    } while (cursor && !limited);
    signal.throwIfAborted();
    return { hits: [...hits.values()], limited, pages };
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
