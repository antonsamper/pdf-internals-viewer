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

const focusSearchToggle = (search: Search) =>
  search.formRef.current?.querySelector<HTMLButtonElement>('.search-show')?.focus({ preventScroll: true });

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
    <div className="search-results-header">
      <span role="status" title={searching || interrupted ? searchingQuery : (resultsQuery ?? undefined)}>
        {statusText(search)}
      </span>
      <div className="search-result-navigation" aria-label="Search result navigation" role="group">
        <span aria-live="polite" aria-atomic="true">
          {pageText ? 'Page ' : 'Match '}
          {results.length ? `${(activeResult ?? 0) + 1} of ${results.length}` : '0 of 0'}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
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
    <div className="search-source-list">
      <span className="search-source-label">{mapped ? 'Bytes' : 'Streams'}</span>
      {sources.map((source, sourceIndex) => (
        <Button
          key={keys[sourceIndex]}
          size="xs"
          className="search-source-location"
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
                ?.querySelector<HTMLElement>('.text-source-bytes .hex-viewport')
                ?.focus({ preventScroll: true })
            );
          }}
        >
          <FileCode2 size={12} />
          <code>
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
    <div className="text-source-links" role="group" aria-label="Page text source locations">
      {!mapped && (
        <span className="search-help">
          Exact word bytes could not be mapped. Stream inspection highlights a candidate container, not the word.
        </span>
      )}
      {location.sources.length > 0 && <SourceButtons index={index} location={location} search={search} textSource={textSource} />}
      <div className="search-result-actions">
        {location.sources.length > 1 && (
          <Button
            size="xs"
            variant="ghost"
            className="search-source-toggle"
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
          variant="ghost"
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
        <code>{result.label}</code>
        <span>{result.detail}</span>
      </>
    );
  return (
    <>
      <span className={`search-result-context ${resultsScope === 'pageText' ? '' : 'search-byte-context'}`}>
        {snippet.before}
        <mark>{snippet.match}</mark>
        {snippet.after}
      </span>
      {!result.pageText && (
        <code className="search-result-meta">
          {result.label}
          <span> · {result.detail}</span>
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
    <div className="search-result-item">
      <button
        className="search-result"
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
          <span className="search-result-page">
            <strong>{result.label}</strong>
            <span>{result.detail}</span>
          </span>
        )}
        <ResultSummary result={result} resultsScope={resultsScope} />
        <ChevronRight size={15} />
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
    <div className="search-empty">
      <Search size={22} aria-hidden="true" />
      <p>No results for “{resultsQuery}”</p>
      <span>{EMPTY_HINTS[resultsScope] ?? 'Try a shorter sequence of complete hexadecimal bytes.'}</span>
      {['objects', 'keys', 'text', 'decoded'].includes(resultsScope) && (
        <Button size="sm" variant="secondary" onClick={searchAsPageText}>
          Search page text instead
        </Button>
      )}
    </div>
  );
};

const CoverageNote = ({ message, resultsScope }: { message: string; resultsScope: string }) =>
  resultsScope === 'pageText' ? (
    <details className="search-help" open={message.startsWith('Showing')}>
      <summary>Search coverage</summary>
      <p>{message}</p>
    </details>
  ) : (
    <p className="search-help">{message}</p>
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
        className="search-results"
        aria-label="Search results"
        data-searching={searching || undefined}
        data-hold-height={searching || showPrevious || undefined}
        onKeyDown={(event) => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (event.target as HTMLElement).classList.contains('search-result')) {
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
        <div className="search-results-body" aria-busy={searching}>
          {showPrevious && <p className="search-previous">Previous results for “{resultsQuery}”</p>}
          {interrupted === 'failed' && message && <p role="status">{message}</p>}
          <div className="search-matches">
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
