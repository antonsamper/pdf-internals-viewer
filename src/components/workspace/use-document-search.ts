import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { InspectorTab } from '@/components/object-inspector';
import type { SearchResult } from '@/lib/pdf/document-search';
import type { ExplorationStep } from '@/lib/pdf/exploration-trail';
import type { PageTextLocation, TextSource } from '@/lib/pdf/page-text';
import type { PdfDocumentInfo, PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { MAX_RESULTS, runDocumentSearch } from '@/lib/pdf/document-search';

import type { Section, Selection } from './types';
import type { useSourceReveal } from './use-source-reveal';

interface SearchDeps {
  bytes: Uint8Array;
  document: PdfDocumentInfo | null;
  objectMap: Map<string, PdfObjectRecord>;
  objects: PdfObjectRecord[];
  previewPassword: string | undefined;
  reveal: ReturnType<typeof useSourceReveal>;
  navigate: (id: string | null, tab?: InspectorTab, section?: Section) => void;
  objectStep: (id: string) => ExplorationStep;
  readStream: (id: string, mode: 'raw' | 'decoded') => Promise<StreamResult>;
  selectRange: (range: { start: number; end: number }) => void;
  setMobilePane: (pane: string) => void;
  setPreview: (preview: boolean) => void;
  setPreviewPage: (page: number) => void;
  visit: (next: Selection) => void;
}

/** Search state, requests and result navigation for the document search box. */
export const useDocumentSearch = (deps: SearchDeps) => {
  const { document, reveal, setMobilePane, setPreview, setPreviewPage } = deps;
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const activeMatchRef = useRef<HTMLButtonElement | null>(null);
  const resultsId = useId();
  const requestId = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('objects');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [activeResult, setActiveResult] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [cancelRequest, setCancelRequest] = useState(0);
  const [cancelReady, setCancelReady] = useState(0);
  const [searchingScope, setSearchingScope] = useState('objects');
  const [resultsScope, setResultsScope] = useState('objects');
  const [searchingQuery, setSearchingQuery] = useState('');
  const [resultsQuery, setResultsQuery] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState<'cancelled' | 'failed' | null>(null);
  const [sourceLocationsPage, setSourceLocationsPage] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      const item = activeMatchRef.current?.closest<HTMLElement>('[data-search-result-item]');
      if (!item) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      item.scrollIntoView({
        behavior: reduced ? 'instant' : 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      if (reduced) return;
      // WebKit sometimes drops a smooth scroll without moving the list at all, so finish the job instantly.
      const body = item.closest('[data-search-results-body]');
      const start = body?.scrollTop;
      settle = setTimeout(() => {
        if (!body || body.scrollTop !== start) return;
        const card = item.getBoundingClientRect();
        const frameBox = body.getBoundingClientRect();
        if (card.top < frameBox.top || card.bottom > frameBox.bottom)
          item.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
      }, 600);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- scroll the active result into view when results or the active index change.
  }, [activeResult, results, open]);
  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(() => setCancelReady(cancelRequest), 600);
    return () => clearTimeout(timer);
  }, [searching, cancelRequest]);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    []
  );
  const previewSearch = useMemo(
    () =>
      resultsScope === 'pageText' && resultsQuery
        ? {
            matches: results?.flatMap((result) => result.pageText?.matches ?? []) ?? [],
            query: resultsQuery,
          }
        : undefined,
    [resultsScope, resultsQuery, results]
  );

  const stop = () => {
    requestId.current++;
    abort.current?.abort();
  };

  const selectTextSource = (location: PageTextLocation, source: TextSource) => {
    const object = deps.objectMap.get(source.id);
    deps.visit({
      id: source.id,
      notice: source.ranges.length
        ? 'Matching source text located. Byte highlights exclude intervening PDF operators.'
        : 'Page text found; this is a candidate content stream. Exact text bytes could not be mapped.',
      range: source.originalRanges?.[0] ?? object?.stream?.range,
      section: 'pages',
      tab: 'decoded',
      trail: [deps.objectStep(location.pageId), deps.objectStep(source.id)],
    });
    reveal.setTextSource(source);
    reveal.reveal();
    setPreviewPage(location.pageNumber);
    setMobilePane('bytes');
  };

  const selectResult = (result: SearchResult, index: number, resultScope = resultsScope) => {
    setActiveResult(index);
    if (result.pageText) {
      const location = result.pageText;
      if (location.sources.length) selectTextSource(location, location.sources[0]);
      else deps.navigate(location.pageId, 'properties', 'pages');
      setPreviewPage(location.pageNumber);
    } else if (result.id) deps.navigate(result.id, resultScope === 'decoded' ? 'decoded' : 'properties');
    else if (result.range) deps.selectRange(result.range);
    reveal.reveal();
  };
  // `search` completes asynchronously and must select with the latest closures.
  const selectLatest = useRef(selectResult);
  useLayoutEffect(() => {
    selectLatest.current = selectResult;
  });

  const move = (direction: number) => {
    if (!results?.length) return;
    const index = ((activeResult ?? (direction > 0 ? -1 : 0)) + direction + results.length) % results.length;
    selectResult(results[index], index);
  };

  const clear = () => {
    reveal.clear();
    setSourceLocationsPage(null);
    stop();
    setQuery('');
    setSearching(false);
    setResults(null);
    setOpen(false);
    setResultsQuery(null);
    setInterrupted(null);
    setActiveResult(null);
    setMessage('');
  };

  const cancel = () => {
    stop();
    setSearching(false);
    setInterrupted('cancelled');
    setMessage('');
  };

  /** Marks a new search as running while the completed results stay visible. */
  const begin = (searchScope: string, term: string) => {
    const token = ++requestId.current;
    setCancelRequest(token);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setOpen(true);
    setSearching(true);
    setSearchingScope(searchScope);
    setSearchingQuery(term);
    setInterrupted(null);
    // Keep the completed results and their scope/selection together until the
    // replacement is ready. Only the status changes while a search is running.
    setResults((current) => current ?? []);
    return { signal: controller.signal, token };
  };

  const finish = (found: SearchResult[], note: string, searchScope: string, term: string) => {
    setResults(found);
    setSourceLocationsPage(null);
    setResultsScope(searchScope);
    setResultsQuery(term);
    reveal.setTextSource(null);
    setActiveResult(null);
    if (found.length) selectLatest.current(found[0], 0, searchScope);
    setMessage(found.length === MAX_RESULTS ? `Showing the first ${MAX_RESULTS} matches. Narrow your search.` : note);
    setSearching(false);
  };

  const fail = (reason: unknown) => {
    setInterrupted('failed');
    setMessage(reason instanceof Error ? reason.message : 'Search failed.');
    setSearching(false);
  };

  const run = async (nextScope?: string) => {
    const searchScope = nextScope ?? scope;
    const term = query.trim();
    if (!term) {
      clear();
      return;
    }
    const { signal, token } = begin(searchScope, term);
    try {
      const outcome = await runDocumentSearch({
        bytes: deps.bytes,
        document,
        isCurrent: () => token === requestId.current,
        objectMap: deps.objectMap,
        objects: deps.objects,
        password: deps.previewPassword,
        readStream: deps.readStream,
        scope: searchScope,
        signal,
        term,
      });
      if (outcome && token === requestId.current) finish(outcome.found, outcome.message, searchScope, term);
    } catch (reason) {
      if (token === requestId.current) fail(reason);
    }
  };

  return {
    activeMatchRef,
    activeResult,
    cancel,
    cancelReady,
    cancelRequest,
    clear,
    displayedScope: searching || interrupted ? searchingScope : resultsScope,
    formRef,
    inputRef,
    interrupted,
    message,
    move,
    open,
    openResultPreview: (result: SearchResult, index: number) => {
      selectResult(result, index);
      setPreviewPage(result.pageText!.pageNumber);
      setPreview(true);
      setMobilePane('inspector');
    },
    previewSearch,
    query,
    reset: () => {
      stop();
      setResults(null);
      setOpen(false);
      setResultsQuery(null);
      setInterrupted(null);
      setSearching(false);
      setQuery('');
      setSourceLocationsPage(null);
    },
    results,
    resultsId,
    resultsQuery,
    resultsScope,
    run,
    scope,
    searchAsPageText: () => {
      setScope('pageText');
      void run('pageText');
    },
    searching,
    searchingQuery,
    selectResult,
    selectSource: (location: PageTextLocation, source: TextSource, index: number) => {
      setActiveResult(index);
      selectTextSource(location, source);
    },
    setOpen,
    setQuery,
    setScope,
    showPrevious: resultsQuery !== null && (searching || interrupted !== null || query.trim() !== resultsQuery),
    sourceLocationsPage,
    stop,
    toggleSources: (pageId: string) => setSourceLocationsPage(sourceLocationsPage === pageId ? null : pageId),
  };
};
