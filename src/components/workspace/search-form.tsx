import { cn } from 'cn';
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react';

import { SearchScopeSelect } from '@/components/search-scope-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { useDocumentSearch } from './use-document-search';

/** Two rows at 360px and below: the results toggle shares the second row with the scope, or the scope fills it. */
const formClass = (hasResults: boolean) =>
  cn(
    'flex items-center',
    'min-h-[34px] w-1/2 max-w-[600px]',
    'gap-1 py-0.5 pr-1 pl-2',
    'text-muted-foreground',
    'rounded-[6px] border',
    'focus-within:border-ring focus-within:shadow-[0_0_0_2px_color-mix(in_oklch,var(--ring)_20%,transparent)]',
    'max-w900:grid max-w900:h-auto max-w900:w-full max-w900:max-w-none max-w900:gap-x-1.5 max-w900:gap-y-1 max-w900:py-1 max-w900:pr-1 max-w900:pl-2.5',
    'max-w360:grid-cols-[18px_minmax(0,1.3fr)_minmax(0,1fr)_auto]',
    "min-w360:max-w900:grid-cols-[18px_minmax(0,1fr)_auto_auto] min-w360:max-w900:[grid-template-areas:'icon_query_mode_submit']",
    hasResults
      ? "max-w360:[grid-template-areas:'icon_query_query_submit'_'mode_mode_results_results']"
      : "max-w360:[grid-template-areas:'icon_query_query_submit'_'mode_mode_mode_mode']"
  );

/** From 361px to 900px the results toggle sits inside the field, so the query keeps room on its right. */
const queryPadding = (query: string, hasResults: boolean) => {
  if (hasResults) return 'min-w360:max-w900:pr-[84px]';
  return query ? 'min-w360:max-w900:pr-9' : '';
};

const inputClass = (query: string, hasResults: boolean) =>
  cn(
    'h-7 flex-1 [grid-area:query]',
    'px-1 py-0',
    'bg-transparent text-foreground',
    'rounded-none border-0',
    'focus-visible:ring-0',
    'max-w900:h-9 max-w900:text-[14px]! supports-[-webkit-touch-callout:none]:max-w900:text-[16px]!',
    'dark:bg-transparent',
    'text-[12px]!',
    query && 'max-w360:pr-9',
    queryPadding(query, hasResults)
  );

const resultUnit = (count: number, scope: string) => {
  const plural = count !== 1;
  if (scope === 'pageText') return plural ? 'pages' : 'page';
  return plural ? 'matches' : 'match';
};

const ResultsToggle = ({ count, onToggle, open, scope }: { count: number; onToggle: () => void; open: boolean; scope: string }) => (
  <Button
    size="xs"
    variant="ghost"
    type="button"
    aria-label="Show search results"
    title="Open search results"
    data-search-show=""
    className={cn(
      'whitespace-nowrap',
      'max-w900:h-9 max-w900:min-w-9 max-w900:justify-between max-w900:rounded-[6px] max-w900:border-0 max-w900:bg-muted max-w900:text-[13px]! max-w900:text-foreground',
      'max-w900:hover:bg-muted max-w900:aria-expanded:bg-accent max-w900:aria-expanded:hover:bg-accent',
      'max-w900:dark:hover:bg-muted max-w900:aria-expanded:dark:hover:bg-accent',
      'max-w360:w-full max-w360:px-2.5 max-w360:[grid-area:results]',
      'min-w360:max-w900:z-1 min-w360:max-w900:mr-9 min-w360:max-w900:h-6.5 min-w360:max-w900:min-w-0 min-w360:max-w900:gap-0.5 min-w360:max-w900:self-center min-w360:max-w900:justify-self-end min-w360:max-w900:rounded-[13px] min-w360:max-w900:px-2 min-w360:max-w900:[grid-area:query]'
    )}
    aria-haspopup="dialog"
    aria-expanded={open}
    onClick={onToggle}
  >
    <span className="min-w360:max-w900:hidden">Results</span>{' '}
    <span className="max-w900:text-[12px] max-w900:text-muted-foreground max-w360:mr-auto">
      {count} <span className="min-w360:max-w900:hidden">{resultUnit(count, scope)}</span>
    </span>
    <ChevronDown size={12} />
  </Button>
);

const ClearButton = ({ onClear }: { onClear: () => void }) => (
  <Button
    size="icon-sm"
    variant="ghost"
    aria-label="Clear search"
    title="Clear query and results"
    className="max-w900:relative max-w900:z-1 max-w900:size-9 max-w900:justify-self-end max-w900:[grid-area:query] max-w900:before:absolute max-w900:before:-inset-x-0.5 max-w900:before:-inset-y-1"
    type="button"
    onClick={onClear}
  >
    <X size={14} />
  </Button>
);

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
          if (results !== null) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' && results?.length && !searching) {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() =>
              activeMatchRef.current?.focus({
                preventScroll: true,
              })
            );
          }
        }}
        onChange={(event) => {
          const value = event.target.value;
          if (value.trim()) {
            setQuery(value);
            if (results !== null) setOpen(true);
          } else clear();
        }}
      />
      <SearchScopeSelect
        value={scope}
        onValueChange={(nextScope) => {
          setScope(nextScope);
          if (nextScope !== scope && query.trim()) void run(nextScope);
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
          'max-w900:relative max-w900:h-9 max-w900:min-w-9 max-w900:bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] max-w900:bg-clip-border max-w900:font-semibold! max-w900:text-(--brand-red-ink) max-w900:before:absolute max-w900:before:-inset-x-0.5 max-w900:before:-inset-y-1',
          'max-w900:enabled:hover:bg-[color-mix(in_oklch,var(--primary)_26%,transparent)] max-w900:enabled:hover:text-(--brand-red-ink)',
          'max-w900:dark:enabled:hover:bg-[color-mix(in_oklch,var(--primary)_26%,transparent)]',
          'max-w360:w-auto max-w360:px-2.5',
          'min-w360:max-w900:w-9 min-w360:max-w900:p-0'
        )}
        disabled={searching || busy}
        aria-busy={searching}
      >
        <ArrowRight className="max-w360:hidden" size={14} />
        <span className="hidden max-w360:inline">Search</span>
      </Button>
      {results !== null && <ResultsToggle count={results.length} open={open} scope={resultsScope} onToggle={() => setOpen(!open)} />}
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
