import type { ComponentProps, KeyboardEvent } from 'react';

import { ChevronDown, ChevronRight, ChevronUp, Eye, FileCode2, Search } from 'lucide-react';

import type { PageTextLocation, TextSource } from '@/lib/pdf/page-text';

import { SearchResultsPopover } from '@/components/search-results-popover';
import { Button } from '@/components/ui/button';
import { MAX_CONTENT_REFERENCES, MAX_TEXT_SOURCES } from '@/lib/pdf/limits';
import { cn } from '@/lib/utils';

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

const statusText = ({ displayedScope, engineLoading, interrupted, results, resultsScope, searching, searchingQuery }: Search) => {
  let headline = countLabel(results?.length ?? 0, resultsScope);

  if (searching) {
    headline = engineLoading ? 'Loading the page text engine…' : `Searching for “${searchingQuery}”…`;
  } else if (interrupted) {
    headline = `Search ${interrupted} for “${searchingQuery}”`;
  }

  return `${headline} · ${SCOPE_LABELS[displayedScope] ?? displayedScope}`;
};

/** A button inside a result card: compact, left aligned, and tall enough to tap on small and touch screens. */
const CardButton = ({ className, ...props }: ComponentProps<typeof Button>) => {
  return (
    <Button
      size="xs"
      className={cn(
        'h-auto min-h-6 max-w-full justify-start',
        'rounded-[4px] px-1.5 py-0.5 text-left text-detail whitespace-normal',
        'pointer-coarse:min-h-11 narrow:not-pointer-coarse:min-h-8',
        className
      )}
      {...props}
    />
  );
};

/** A header button in the header's 12px type that grows to a 44px touch target on small screens. */
const HeaderButton = ({ className, ...props }: ComponentProps<typeof Button>) => {
  return <Button variant="ghost" className={cn('text-small narrow:min-h-11 narrow:min-w-11', className)} {...props} />;
};

const ResultsNote = ({ className, ...props }: ComponentProps<'p'>) => {
  return <p className={cn('px-3.5 py-2.5 text-small [overflow-wrap:anywhere]', className)} {...props} />;
};

const focusSearchToggle = (search: Search) => {
  return search.formRef.current?.querySelector<HTMLButtonElement>('[data-search-show]')?.focus({ preventScroll: true });
};

const ResultNavigation = ({ search }: { search: Search }) => {
  const { activeResult, move, resultsScope, searching } = search;
  const results = search.results ?? [];
  const pageText = resultsScope === 'pageText';

  return (
    <div className="ml-auto flex items-center gap-0.5 whitespace-nowrap" aria-label="Search result navigation" role="group">
      <span className="mr-1.5 text-detail" aria-live="polite" aria-atomic="true">
        {pageText ? 'Page ' : 'Match '}
        {results.length ? `${(activeResult ?? 0) + 1} of ${results.length}` : '0 of 0'}
      </span>
      <HeaderButton
        size="icon-sm"
        aria-label="Previous search result"
        title={pageText ? 'Previous matching page' : 'Previous match'}
        disabled={searching || results.length < 2}
        onClick={() => {
          return move(-1);
        }}
      >
        <ChevronUp size={14} />
      </HeaderButton>
      <HeaderButton
        size="icon-sm"
        aria-label="Next search result"
        title={pageText ? 'Next matching page' : 'Next match'}
        disabled={searching || results.length < 2}
        onClick={() => {
          return move(1);
        }}
      >
        <ChevronDown size={14} />
      </HeaderButton>
    </div>
  );
};

const ResultsHeader = ({ search }: { search: Search }) => {
  const { cancel, cancelReady, cancelRequest, inputRef, interrupted, resultsQuery, searching, searchingQuery } = search;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 px-3 py-2',
        'border-b bg-sidebar text-small text-muted-foreground',
        'narrow:px-2 narrow:py-1.5'
      )}
    >
      <span
        className={cn('min-w-0 flex-1 overflow-hidden', 'text-ellipsis whitespace-nowrap', 'narrow:leading-[1.4] narrow:whitespace-normal')}
        role="status"
        title={searching || interrupted ? searchingQuery : (resultsQuery ?? undefined)}
      >
        {statusText(search)}
      </span>
      <ResultNavigation search={search} />
      {searching && cancelReady === cancelRequest && (
        <HeaderButton
          size="xs"
          aria-label="Cancel search"
          title="Cancel search"
          onClick={() => {
            cancel();
            inputRef.current?.focus();
          }}
        >
          Cancel
        </HeaderButton>
      )}
      <HeaderButton
        size="xs"
        aria-label="Hide search results"
        title="Hide results (Esc)"
        onClick={() => {
          search.setOpen(false);
          inputRef.current?.focus();
        }}
      >
        Close
      </HeaderButton>
    </div>
  );
};

const hexOffset = (value: number) => {
  return `0x${value.toString(16).toUpperCase()}`;
};

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
  const keys = uniqueKeys(sources, (source) => {
    return `${source.id}:${source.ranges[0]?.start ?? 'candidate'}`;
  });
  const mapped = location.sources.some((source) => {
    return source.ranges.length;
  });

  return (
    <div className={cn('flex flex-wrap items-center gap-1', 'max-w400:grid max-w400:grid-cols-2 max-w400:gap-x-2 max-w400:gap-y-1')}>
      <span className="mr-0.5 text-detail text-muted-foreground max-w400:col-span-full max-w400:m-0">{mapped ? 'Bytes' : 'Streams'}</span>
      {sources.map((source, sourceIndex) => {
        return (
          <CardButton
            key={keys[sourceIndex]}
            className="max-w400:min-w-0 max-w400:justify-self-start"
            variant={textSource === source ? 'secondary' : 'ghost'}
            aria-label={`${source.ranges.length ? 'Show bytes' : 'Inspect content stream'} · ${source.id} obj${source.ranges[0] ? ` · ${hexOffset(source.ranges[0].start)}` : ''}`}
            title={source.ranges.length ? 'Show matching bytes' : 'Inspect candidate content stream'}
            aria-pressed={textSource === source}
            disabled={searching}
            onClick={() => {
              selectSource(location, source, index);
              setOpen(false);
              requestAnimationFrame(() => {
                return formRef.current
                  ?.closest('[data-app-shell]')
                  ?.querySelector<HTMLElement>('[data-text-source-bytes] [data-hex-viewport]')
                  ?.focus({ preventScroll: true });
              });
            }}
          >
            <FileCode2 size={12} />
            <code className="text-detail font-normal max-w400:[overflow-wrap:anywhere]">
              {source.ranges.length ? source.id : `Candidate ${source.id}`}
              {source.ranges[0] ? ` · ${hexOffset(source.ranges[0].start)}` : ''}
            </code>
          </CardButton>
        );
      })}
    </div>
  );
};

const SourcesNote = ({ className, ...props }: ComponentProps<'span'>) => {
  return <span className={cn('mb-0.5 text-detail text-muted-foreground', className)} {...props} />;
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
  const mapped = location.sources.some((source) => {
    return source.ranges.length;
  });

  return (
    <div className="mx-3 mb-2.5 flex flex-col items-stretch gap-1.5 border-t pt-2" role="group" aria-label="Page text source locations">
      {!mapped && (
        <SourcesNote>Exact word bytes could not be mapped. Stream inspection highlights a candidate container, not the word.</SourcesNote>
      )}
      {location.sourcesLimited && (
        <SourcesNote>
          This page has more than {MAX_TEXT_SOURCES} source locations. Only the first {MAX_TEXT_SOURCES} are listed.
        </SourcesNote>
      )}
      {location.contentsLimited && (
        <SourcesNote>
          This page lists more than {MAX_CONTENT_REFERENCES.toLocaleString('en-GB')} content references. Streams after the first{' '}
          {MAX_CONTENT_REFERENCES.toLocaleString('en-GB')} were not read.
        </SourcesNote>
      )}
      {location.sources.length > 0 && <SourceButtons index={index} location={location} search={search} textSource={textSource} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 max-w400:grid max-w400:grid-cols-2 max-w400:gap-2">
        {location.sources.length > 1 && (
          <CardButton
            variant="link"
            className="px-0 text-muted-foreground underline-offset-3"
            disabled={searching}
            aria-expanded={expanded}
            onClick={() => {
              return toggleSources(location.pageId);
            }}
          >
            {expanded ? 'Fewer sources' : `${location.sources.length - 1} more source${location.sources.length > 2 ? 's' : ''}`}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </CardButton>
        )}
        <CardButton
          variant="link"
          className="px-0 text-reference underline-offset-3"
          disabled={searching}
          onClick={() => {
            openResultPreview(result, index);
            setOpen(false);
            focusSearchToggle(search);
          }}
        >
          Open page preview
          <Eye size={12} />
        </CardButton>
      </div>
    </div>
  );
};

const ResultSummary = ({ result, resultsScope }: { result: SearchResult; resultsScope: string }) => {
  const { snippet } = result;

  if (!snippet) {
    return (
      <>
        <code className="col-start-1 text-small font-semibold text-foreground">{result.label}</code>
        <span className="col-start-1 text-small [overflow-wrap:anywhere] text-muted-foreground">{result.detail}</span>
      </>
    );
  }

  return (
    <>
      <span
        className={cn('col-start-1 text-body [overflow-wrap:anywhere] text-foreground', resultsScope !== 'pageText' && 'font-mono')}
        data-search-result-context=""
      >
        {snippet.before}
        <mark className="rounded-xs bg-byte-selection px-px text-byte-selection-foreground">{snippet.match}</mark>
        {snippet.after}
      </span>
      {!result.pageText && (
        <code className="col-start-1 text-detail font-normal text-muted-foreground" data-search-result-meta="">
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
        'scroll-my-2 overflow-hidden bg-background',
        'rounded-md border',
        'has-[[aria-current=true]]:border-reference has-[[aria-current=true]]:shadow-[0_0_0_1px_var(--reference)]'
      )}
      data-search-result-item=""
    >
      <button
        className={cn(
          'grid w-full grid-cols-[minmax(0,1fr)_18px]',
          'gap-x-3 gap-y-1 bg-transparent px-3.5 py-3 text-left',
          'hover:bg-muted focus-visible:-outline-offset-2 aria-[current=true]:bg-accent'
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
            className={cn('col-start-1 flex items-baseline justify-between gap-3', 'text-small [overflow-wrap:anywhere] text-foreground')}
          >
            <strong className="text-small font-semibold">{result.label}</strong>
            <span className="text-detail whitespace-nowrap text-muted-foreground">{result.detail}</span>
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
    <div className={cn('flex min-h-25 flex-col items-center justify-center', 'gap-2.5 p-5 text-center text-muted-foreground')}>
      <Search size={22} aria-hidden="true" />
      <p className="text-body [overflow-wrap:anywhere] text-foreground">No results for “{resultsQuery}”</p>
      <span className="text-small">{EMPTY_HINTS[resultsScope] ?? 'Try a shorter sequence of complete hexadecimal bytes.'}</span>
      {['objects', 'keys', 'text', 'decoded'].includes(resultsScope) && (
        <Button className="narrow:min-h-11" size="sm" variant="secondary" onClick={searchAsPageText}>
          Search page text instead
        </Button>
      )}
    </div>
  );
};

const CoverageNote = ({ message, resultsScope }: { message: string; resultsScope: string }) => {
  return resultsScope === 'pageText' ? (
    <details className="border-t px-3.5 py-2.5 text-detail text-muted-foreground" open={message.startsWith('Showing')}>
      <summary className="cursor-pointer">Search coverage</summary>
      <p className="mt-2 leading-normal">{message}</p>
    </details>
  ) : (
    <ResultsNote className="text-muted-foreground">{message}</ResultsNote>
  );
};

/** Arrow keys on a result card step through the results and keep focus on the active card. */
const stepWithArrows = (search: Search) => {
  return (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || !(event.target as HTMLElement).matches('[data-search-result]')) {
      return;
    }

    event.preventDefault();
    search.move(event.key === 'ArrowDown' ? 1 : -1);
    requestAnimationFrame(() => {
      return search.activeMatchRef.current?.focus({
        preventScroll: true,
      });
    });
  };
};

const ResultsBody = ({ search, textSource }: { search: Search; textSource: TextSource | null }) => {
  const { interrupted, message, resultsQuery, resultsScope, searching, showPrevious } = search;
  const results = search.results ?? [];
  const keys = uniqueKeys(results, (result) => {
    return result.label;
  });
  const settled = !searching && !interrupted;

  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain" data-search-results-body="" aria-busy={searching}>
      {showPrevious && (
        <ResultsNote className="text-muted-foreground" data-search-previous="">
          Previous results for “{resultsQuery}”
        </ResultsNote>
      )}
      {interrupted === 'failed' && message && <ResultsNote role="status">{message}</ResultsNote>}
      <div className="flex flex-col gap-3 bg-muted p-3 group-data-searching/results:opacity-55" data-search-matches="">
        {results.map((result, index) => {
          return <ResultItem key={keys[index]} index={index} result={result} search={search} textSource={textSource} />;
        })}
      </div>
      {settled && !results.length && <EmptyResults search={search} />}
      {settled && message && <CoverageNote message={message} resultsScope={resultsScope} />}
    </div>
  );
};

export const SearchResultsPanel = ({ search, textSource }: { search: Search; textSource: TextSource | null }) => {
  const { formRef, inputRef, open, results, resultsId, searching, setOpen, showPrevious } = search;

  if (results === null) {
    return null;
  }

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
          'max-h-[min(480px,60dvh,var(--available-height,480px))] min-h-25',
          'bg-background',
          'data-hold-height:h-[var(--search-loading-height,180px)]'
        )}
        aria-label="Search results"
        data-search-results=""
        data-searching={searching || undefined}
        data-hold-height={searching || showPrevious || undefined}
        onKeyDown={stepWithArrows(search)}
      >
        <ResultsHeader search={search} />
        <ResultsBody search={search} textSource={textSource} />
      </section>
    </SearchResultsPopover>
  );
};
