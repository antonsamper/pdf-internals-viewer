import { cn } from 'cn';
import { ChevronDown, ChevronRight, ChevronUp, Eye, FileCode2, Search } from 'lucide-react';

import type { PageTextLocation, TextSource } from '@/lib/pdf/page-text';

import { SearchResultsPopover } from '@/components/search-results-popover';
import { Button } from '@/components/ui/button';

import type { SearchResult } from './types';
import type { useDocumentSearch } from './use-document-search';

import { uniqueKeys } from './keys';

type Search = ReturnType<typeof useDocumentSearch>;

const SCOPE_LABELS: Record<string, string> = {
  decoded: 'decoded streams',
  pageText: 'page text',
  text: 'Latin-1 file bytes',
};

const EMPTY_HINTS: Record<string, string> = {
  decoded: 'Compression and font encodings can hide visible words in PDF bytes.',
  keys: 'This mode searches PDF structure, rather than words printed on a page.',
  objects: 'This mode searches PDF structure, rather than words printed on a page.',
  pageText: 'Try a shorter phrase. Scanned pages without a text layer need OCR.',
  text: 'Compression and font encodings can hide visible words in PDF bytes.',
};

const countLabel = (count: number, scope: string) => {
  const noun = scope === 'pageText' ? 'page' : 'match';
  const plural = scope === 'pageText' ? 'pages' : 'matches';
  return `${count} ${count === 1 ? noun : plural}`;
};

const statusText = ({ displayedScope, interrupted, results, resultsScope, searching, searchingQuery }: Search) => {
  let headline = countLabel(results?.length ?? 0, resultsScope);
  if (searching) headline = `Searching for “${searchingQuery}”…`;
  else if (interrupted) headline = `Search ${interrupted} for “${searchingQuery}”`;
  return `${headline} · ${SCOPE_LABELS[displayedScope] ?? displayedScope}`;
};

/** Buttons inside a result card: compact, left aligned, and tall enough to tap on small and touch screens. */
const CARD_BUTTON = cn(
  'justify-start',
  'h-auto min-h-6 max-w-full',
  'px-1.5 py-0.5',
  'text-left whitespace-normal',
  'rounded-[4px]',
  'pointer-coarse:min-h-11',
  'max-w900:min-h-8',
  'text-[11px]!'
);

/** Header buttons grow to a 44px touch target on small screens. */
const HEADER_BUTTON = 'max-w900:min-h-11 max-w900:min-w-11';

/** Notes above and below the result cards. */
const BODY_NOTE = 'px-3.5 py-2.5 text-[12px] [overflow-wrap:anywhere]';

const focusSearchToggle = (search: Search) =>
  search.formRef.current?.querySelector<HTMLButtonElement>('[data-search-show]')?.focus({ preventScroll: true });

const ResultsHeader = ({ search }: { search: Search }) => {
  const {
    activeResult,
    cancel,
    cancelReady,
    cancelRequest,
    inputRef,
    interrupted,
    move,
    resultsQuery,
    resultsScope,
    searching,
    searchingQuery,
  } = search;
  const results = search.results ?? [];
  const pageText = resultsScope === 'pageText';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center',
        'gap-2 px-3 py-2',
        'text-[12px] text-muted-foreground',
        'bg-sidebar',
        'border-b',
        'max-w900:px-2 max-w900:py-1.5'
      )}
    >
      <span
        className={cn(
          'flex-1 overflow-hidden',
          'min-w-0',
          'text-ellipsis whitespace-nowrap',
          'max-w900:leading-[1.4] max-w900:whitespace-normal'
        )}
        role="status"
        title={searching || interrupted ? searchingQuery : (resultsQuery ?? undefined)}
      >
        {statusText(search)}
      </span>
      <div className="ml-auto flex items-center gap-0.5 whitespace-nowrap" aria-label="Search result navigation" role="group">
        <span className="mr-1.5 text-[11px]" aria-live="polite" aria-atomic="true">
          {pageText ? 'Page ' : 'Match '}
          {results.length ? `${(activeResult ?? 0) + 1} of ${results.length}` : '0 of 0'}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          className={HEADER_BUTTON}
          aria-label="Previous search result"
          title={pageText ? 'Previous matching page' : 'Previous match'}
          disabled={searching || results.length < 2}
          onClick={() => move(-1)}
        >
          <ChevronUp size={14} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className={HEADER_BUTTON}
          aria-label="Next search result"
          title={pageText ? 'Next matching page' : 'Next match'}
          disabled={searching || results.length < 2}
          onClick={() => move(1)}
        >
          <ChevronDown size={14} />
        </Button>
      </div>
      {searching && cancelReady === cancelRequest && (
        <Button
          size="xs"
          variant="ghost"
          className={HEADER_BUTTON}
          aria-label="Cancel search"
          title="Cancel search"
          onClick={() => {
            cancel();
            inputRef.current?.focus();
          }}
        >
          Cancel
        </Button>
      )}
      <Button
        size="xs"
        variant="ghost"
        className={HEADER_BUTTON}
        aria-label="Hide search results"
        title="Hide results (Esc)"
        onClick={() => {
          search.setOpen(false);
          inputRef.current?.focus();
        }}
      >
        Close
      </Button>
    </div>
  );
};

const hexOffset = (value: number) => `0x${value.toString(16).toUpperCase()}`;

const SourceButtons = ({
  index,
  location,
  search,
  textSource,
}: {
  index: number;
  location: PageTextLocation;
  search: Search;
  textSource: TextSource | null;
}) => {
  const { formRef, searching, selectSource, setOpen, sourceLocationsPage } = search;
  const sources = location.sources.slice(0, sourceLocationsPage === location.pageId ? undefined : 1);
  const keys = uniqueKeys(sources, (source) => `${source.id}:${source.ranges[0]?.start ?? 'candidate'}`);
  const mapped = location.sources.some((source) => source.ranges.length);
  return (
    <div className={cn('flex flex-wrap items-center', 'gap-1', 'max-w400:grid max-w400:grid-cols-2 max-w400:gap-x-2 max-w400:gap-y-1')}>
      <span className={cn('mr-0.5', 'text-[11px] text-muted-foreground', 'max-w400:col-span-full max-w400:m-0')}>
        {mapped ? 'Bytes' : 'Streams'}
      </span>
      {sources.map((source, sourceIndex) => (
        <Button
          key={keys[sourceIndex]}
          size="xs"
          className={cn(CARD_BUTTON, 'max-w400:min-w-0 max-w400:justify-self-start')}
          variant={textSource === source ? 'secondary' : 'ghost'}
          aria-label={`${source.ranges.length ? 'Show bytes' : 'Inspect content stream'} · ${source.id} obj${source.ranges[0] ? ` · ${hexOffset(source.ranges[0].start)}` : ''}`}
          title={source.ranges.length ? 'Show matching bytes' : 'Inspect candidate content stream'}
          aria-pressed={textSource === source}
          disabled={searching}
          onClick={() => {
            selectSource(location, source, index);
            setOpen(false);
            requestAnimationFrame(() =>
              formRef.current
                ?.closest('[data-app-shell]')
                ?.querySelector<HTMLElement>('[data-text-source-bytes] .hex-viewport')
                ?.focus({ preventScroll: true })
            );
          }}
        >
          <FileCode2 size={12} />
          <code className="text-[11px]! font-normal max-w400:[overflow-wrap:anywhere]">
            {source.ranges.length ? source.id : `Candidate ${source.id}`}
            {source.ranges[0] ? ` · ${hexOffset(source.ranges[0].start)}` : ''}
          </code>
        </Button>
      ))}
    </div>
  );
};

const PageTextLinks = ({
  index,
  location,
  result,
  search,
  textSource,
}: {
  index: number;
  location: PageTextLocation;
  result: SearchResult;
  search: Search;
  textSource: TextSource | null;
}) => {
  const { openResultPreview, searching, setOpen, sourceLocationsPage, toggleSources } = search;
  const expanded = sourceLocationsPage === location.pageId;
  const mapped = location.sources.some((source) => source.ranges.length);
  return (
    <div
      className={cn('flex flex-col items-stretch', 'mx-3 mb-2.5 gap-1.5 pt-2', 'border-t')}
      role="group"
      aria-label="Page text source locations"
    >
      {!mapped && (
        <span className="mb-0.5 text-[11px] leading-normal text-muted-foreground">
          Exact word bytes could not be mapped. Stream inspection highlights a candidate container, not the word.
        </span>
      )}
      {location.sources.length > 0 && <SourceButtons index={index} location={location} search={search} textSource={textSource} />}
      <div className={cn('flex flex-wrap items-center', 'gap-x-4 gap-y-1', 'max-w400:grid max-w400:grid-cols-2 max-w400:gap-2')}>
        {location.sources.length > 1 && (
          <Button
            size="xs"
            variant="link"
            className={cn(CARD_BUTTON, 'px-0 text-muted-foreground underline-offset-[3px]')}
            disabled={searching}
            aria-expanded={expanded}
            onClick={() => toggleSources(location.pageId)}
          >
            {expanded ? 'Fewer sources' : `${location.sources.length - 1} more source${location.sources.length > 2 ? 's' : ''}`}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
        )}
        <Button
          size="xs"
          variant="link"
          className={cn(CARD_BUTTON, 'px-0 text-(--reference) underline-offset-[3px]')}
          disabled={searching}
          onClick={() => {
            openResultPreview(result, index);
            setOpen(false);
            focusSearchToggle(search);
          }}
        >
          Open page preview
          <Eye size={12} />
        </Button>
      </div>
    </div>
  );
};

const ResultSummary = ({ result, resultsScope }: { result: SearchResult; resultsScope: string }) => {
  const { snippet } = result;
  if (!snippet)
    return (
      <>
        <code className="col-start-1 text-[12px]! font-semibold text-foreground">{result.label}</code>
        <span className={cn('col-start-1', 'text-[12px] leading-normal [overflow-wrap:anywhere] text-muted-foreground')}>
          {result.detail}
        </span>
      </>
    );
  return (
    <>
      <span
        className={cn(
          'col-start-1',
          'text-[13px] leading-normal [overflow-wrap:anywhere] text-foreground',
          resultsScope !== 'pageText' && '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]'
        )}
        data-search-result-context=""
      >
        {snippet.before}
        <mark className={cn('px-px', 'text-(--byte-selection-foreground)', 'bg-(--byte-selection)', 'rounded-[2px]')}>{snippet.match}</mark>
        {snippet.after}
      </span>
      {!result.pageText && (
        <code className="col-start-1 text-[11px]! font-normal text-muted-foreground" data-search-result-meta="">
          {result.label}
          <span className="font-sans"> · {result.detail}</span>
        </code>
      )}
    </>
  );
};

const ResultItem = ({
  index,
  result,
  search,
  textSource,
}: {
  index: number;
  result: SearchResult;
  search: Search;
  textSource: TextSource | null;
}) => {
  const { activeMatchRef, activeResult, inputRef, resultsScope, searching, selectResult, setOpen } = search;
  return (
    <div
      className={cn(
        'overflow-hidden',
        'scroll-my-2',
        'bg-background',
        'rounded-[8px] border',
        'has-[[aria-current=true]]:border-(--reference) has-[[aria-current=true]]:shadow-[0_0_0_1px_var(--reference)]'
      )}
      data-search-result-item=""
    >
      <button
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_18px]',
          'w-full',
          'gap-x-3 gap-y-1 px-3.5 py-3',
          'text-left',
          'bg-transparent',
          'hover:bg-muted focus-visible:-outline-offset-2! aria-[current=true]:bg-accent'
        )}
        data-search-result=""
        ref={index === activeResult ? activeMatchRef : undefined}
        aria-current={index === activeResult ? 'true' : undefined}
        disabled={searching}
        onClick={(event) => {
          selectResult(result, index);
          setOpen(false);
          if (event.detail === 0) {
            inputRef.current?.focus({
              preventScroll: true,
            });
          } else {
            // Keep a useful keyboard position without reopening
            // the software keyboard after a touch selection.
            focusSearchToggle(search);
          }
        }}
      >
        {result.pageText && (
          <span
            className={cn(
              'col-start-1 flex items-baseline justify-between',
              'gap-3',
              'text-[12px] leading-normal [overflow-wrap:anywhere] text-foreground'
            )}
          >
            <strong className="text-[12px] font-semibold">{result.label}</strong>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">{result.detail}</span>
          </span>
        )}
        <ResultSummary result={result} resultsScope={resultsScope} />
        <ChevronRight
          className={cn('col-start-2 self-center text-muted-foreground', result.pageText ? 'row-start-2' : 'row-span-2 row-start-1')}
          size={15}
        />
      </button>
      {resultsScope === 'pageText' && result.pageText && (
        <PageTextLinks index={index} location={result.pageText} result={result} search={search} textSource={textSource} />
      )}
    </div>
  );
};

const EmptyResults = ({ search }: { search: Search }) => {
  const { resultsQuery, resultsScope, searchAsPageText } = search;
  return (
    <div className={cn('flex flex-col items-center justify-center', 'min-h-[100px]', 'gap-2.5 p-5', 'text-center text-muted-foreground')}>
      <Search size={22} aria-hidden="true" />
      <p className="text-[13px] [overflow-wrap:anywhere] text-foreground">No results for “{resultsQuery}”</p>
      <span className="text-[12px]">{EMPTY_HINTS[resultsScope] ?? 'Try a shorter sequence of complete hexadecimal bytes.'}</span>
      {['objects', 'keys', 'text', 'decoded'].includes(resultsScope) && (
        <Button className="max-w900:min-h-11" size="sm" variant="secondary" onClick={searchAsPageText}>
          Search page text instead
        </Button>
      )}
    </div>
  );
};

const CoverageNote = ({ message, resultsScope }: { message: string; resultsScope: string }) =>
  resultsScope === 'pageText' ? (
    <details className="border-t px-3.5 py-2.5 text-[11px] text-muted-foreground" open={message.startsWith('Showing')}>
      <summary className="cursor-pointer">Search coverage</summary>
      <p className="mt-2 leading-normal">{message}</p>
    </details>
  ) : (
    <p className={cn(BODY_NOTE, 'text-muted-foreground')}>{message}</p>
  );

export const SearchResultsPanel = ({ search, textSource }: { search: Search; textSource: TextSource | null }) => {
  const {
    activeMatchRef,
    formRef,
    inputRef,
    interrupted,
    message,
    move,
    open,
    results,
    resultsId,
    resultsQuery,
    resultsScope,
    searching,
    setOpen,
    showPrevious,
  } = search;
  if (results === null) return null;
  const keys = uniqueKeys(results, (result) => result.label);
  return (
    <SearchResultsPopover
      id={resultsId}
      open={open}
      busy={searching || showPrevious}
      onOpenChange={setOpen}
      anchor={formRef}
      input={inputRef}
    >
      <section
        className={cn(
          'group/results flex flex-col overflow-hidden',
          'max-h-[min(480px,60dvh,var(--available-height,480px))] min-h-[100px]',
          'bg-background',
          'data-hold-height:h-[var(--search-loading-height,180px)]'
        )}
        aria-label="Search results"
        data-search-results=""
        data-searching={searching || undefined}
        data-hold-height={searching || showPrevious || undefined}
        onKeyDown={(event) => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (event.target as HTMLElement).matches('[data-search-result]')) {
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1);
            requestAnimationFrame(() =>
              activeMatchRef.current?.focus({
                preventScroll: true,
              })
            );
          }
        }}
      >
        <ResultsHeader search={search} />
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain" data-search-results-body="" aria-busy={searching}>
          {showPrevious && (
            <p className={cn(BODY_NOTE, 'text-muted-foreground')} data-search-previous="">
              Previous results for “{resultsQuery}”
            </p>
          )}
          {interrupted === 'failed' && message && (
            <p className={BODY_NOTE} role="status">
              {message}
            </p>
          )}
          <div className={cn('flex flex-col', 'gap-3 p-3', 'bg-muted', 'group-data-searching/results:opacity-55')} data-search-matches="">
            {results.map((result, index) => (
              <ResultItem key={keys[index]} index={index} result={result} search={search} textSource={textSource} />
            ))}
          </div>
          {!searching && !interrupted && !results.length && <EmptyResults search={search} />}
          {!searching && !interrupted && message && <CoverageNote message={message} resultsScope={resultsScope} />}
        </div>
      </section>
    </SearchResultsPopover>
  );
};
