import { ArrowRight, ChevronDown, Search, X } from 'lucide-react';

import { SearchScopeSelect } from '@/components/search-scope-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { useDocumentSearch } from './use-document-search';

/** Two rows at 360px and below: the results toggle shares the second row with the scope, or the scope fills it. */
const formClass = (hasResults: boolean) => {
  return cn(
    'flex items-center',
    'min-h-8.5 w-1/2 max-w-150',
    'gap-1 py-0.5 pr-1 pl-2 text-muted-foreground',
    'rounded-sm border',
    'has-[input:focus]:border-ring has-[input:focus]:shadow-[0_0_0_2px_color-mix(in_oklch,var(--ring)_20%,transparent)]',
    'narrow:grid narrow:h-auto narrow:w-full narrow:max-w-none narrow:gap-x-1.5 narrow:gap-y-1 narrow:py-1 narrow:pr-1 narrow:pl-2.5',
    'max-w360:grid-cols-[18px_minmax(0,1.3fr)_minmax(0,1fr)_auto]',
    "w360-w900:grid-cols-[18px_minmax(0,1fr)_auto_auto] w360-w900:[grid-template-areas:'icon_query_mode_submit']",
    hasResults
      ? "max-w360:[grid-template-areas:'icon_query_query_submit'_'mode_mode_results_results']"
      : "max-w360:[grid-template-areas:'icon_query_query_submit'_'mode_mode_mode_mode']"
  );
};

/** From 361px to 900px the results toggle sits inside the field, so the query keeps room on its right. */
const queryPadding = (query: string, hasResults: boolean) => {
  if (hasResults) {
    return 'w360-w900:pr-21';
  }

  return query ? 'w360-w900:pr-9' : '';
};

const inputClass = (query: string, hasResults: boolean) => {
  return cn(
    'h-7 flex-1 px-1 py-0 [grid-area:query]',
    'text-small text-foreground',
    'bg-transparent',
    'rounded-none border-0',
    'focus-visible:ring-0',
    'narrow:h-9 narrow:text-reading supports-[-webkit-touch-callout:none]:narrow:text-subheading',
    'dark:bg-transparent',
    query && 'max-w360:pr-9',
    queryPadding(query, hasResults)
  );
};

const resultUnit = (count: number, scope: string) => {
  const plural = count !== 1;

  if (scope === 'pageText') {
    return plural ? 'pages' : 'page';
  }

  return plural ? 'matches' : 'match';
};

const ResultsToggle = ({ count, onToggle, open, scope }: { count: number; onToggle: () => void; open: boolean; scope: string }) => {
  return (
    <Button
      size="xs"
      variant="ghost"
      type="button"
      aria-label="Show search results"
      title="Open search results"
      data-search-show=""
      className={cn(
        'whitespace-nowrap',
        'narrow:h-9 narrow:min-w-9 narrow:justify-between narrow:rounded-sm narrow:border-0 narrow:bg-muted narrow:text-body narrow:text-foreground',
        'narrow:hover:bg-muted narrow:aria-expanded:bg-accent narrow:aria-expanded:hover:bg-accent',
        'narrow:dark:hover:bg-muted narrow:aria-expanded:dark:hover:bg-accent',
        'max-w360:w-full max-w360:px-2.5 max-w360:[grid-area:results]',
        'w360-w900:z-1 w360-w900:mr-9 w360-w900:h-6.5 w360-w900:min-w-0 w360-w900:gap-0.5 w360-w900:self-center w360-w900:justify-self-end w360-w900:rounded-[13px] w360-w900:px-2 w360-w900:[grid-area:query]'
      )}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="w360-w900:hidden">Results</span>{' '}
      <span className="max-w360:mr-auto narrow:text-small narrow:text-muted-foreground">
        {count} <span className="w360-w900:hidden">{resultUnit(count, scope)}</span>
      </span>
      <ChevronDown size={12} />
    </Button>
  );
};

const ClearButton = ({ onClear }: { onClear: () => void }) => {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Clear search"
      title="Clear query and results"
      className={cn(
        'narrow:relative narrow:z-1 narrow:size-9 narrow:justify-self-end narrow:[grid-area:query]',
        'narrow:before:absolute narrow:before:-inset-x-0.5 narrow:before:-inset-y-1'
      )}
      type="button"
      onClick={onClear}
    >
      <X size={14} />
    </Button>
  );
};

export const SearchForm = ({ busy, search }: { busy: boolean; search: ReturnType<typeof useDocumentSearch> }) => {
  const {
    activeMatchRef,
    clear,
    formRef,
    inputRef,
    open,
    query,
    results,
    resultsId,
    resultsScope,
    run,
    scope,
    searching,
    setOpen,
    setQuery,
    setScope,
  } = search;
  const hasResults = results !== null;

  return (
    <form
      ref={formRef}
      className={formClass(hasResults)}
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      <Search className="flex-[0_0_18px] [grid-area:icon]" size={14} />
      <Input
        className={inputClass(query, hasResults)}
        ref={inputRef}
        aria-label="Search document"
        placeholder="Search document…"
        value={query}
        type="text"
        enterKeyHint="search"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-expanded={results !== null && open}
        aria-haspopup="dialog"
        aria-controls={results !== null && open ? resultsId : undefined}
        onClick={() => {
          if (results !== null) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }

          if (event.key === 'ArrowDown' && results?.length && !searching) {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => {
              return activeMatchRef.current?.focus({
                preventScroll: true,
              });
            });
          }
        }}
        onChange={(event) => {
          const value = event.target.value;

          if (value.trim()) {
            setQuery(value);
            if (results !== null) {
              setOpen(true);
            }
          } else {
            clear();
          }
        }}
      />
      <SearchScopeSelect
        value={scope}
        onValueChange={(nextScope) => {
          setScope(nextScope);
          if (nextScope !== scope && query.trim()) {
            void run(nextScope);
          }
        }}
      />
      <Button
        size="icon-sm"
        variant="ghost"
        type="submit"
        aria-label="Run search"
        title="Run search"
        className={cn(
          '[grid-area:submit]',
          'narrow:relative narrow:h-9 narrow:min-w-9 narrow:bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] narrow:bg-clip-border narrow:font-semibold narrow:text-(--brand-red-ink) narrow:before:absolute narrow:before:-inset-x-0.5 narrow:before:-inset-y-1',
          'narrow:enabled:hover:bg-[color-mix(in_oklch,var(--primary)_26%,transparent)] narrow:enabled:hover:text-(--brand-red-ink)',
          'narrow:dark:enabled:hover:bg-[color-mix(in_oklch,var(--primary)_26%,transparent)]',
          'max-w360:w-auto max-w360:px-2.5',
          'w360-w900:w-9 w360-w900:p-0'
        )}
        disabled={searching || busy}
        aria-busy={searching}
      >
        <ArrowRight className="max-w360:hidden" size={14} />
        <span className="hidden max-w360:inline">Search</span>
      </Button>
      {results !== null && (
        <ResultsToggle
          count={results.length}
          open={open}
          scope={resultsScope}
          onToggle={() => {
            return setOpen(!open);
          }}
        />
      )}
      {query && (
        <ClearButton
          onClear={() => {
            clear();
            inputRef.current?.focus();
          }}
        />
      )}
    </form>
  );
};
