import { ArrowRight, ChevronDown, Search, X } from 'lucide-react';

import { SearchScopeSelect } from '@/components/search-scope-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { useDocumentSearch } from './use-document-search';

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
  return (
    <form
      ref={formRef}
      className="search-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      <Search className="search-input-icon" size={14} />
      <Input
        className="search-query"
        ref={inputRef}
        aria-label="Search document"
        placeholder="Search document…"
        value={query}
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
        className="search-submit"
        disabled={searching || busy}
      >
        <ArrowRight size={14} />
        <span>Search</span>
      </Button>
      {results !== null && (
        <Button
          size="xs"
          variant="ghost"
          type="button"
          aria-label="Show search results"
          title="Open search results"
          className="search-show"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Results{' '}
          <span>
            {results.length}{' '}
            {resultsScope === 'pageText' ? (results.length === 1 ? 'page' : 'pages') : results.length === 1 ? 'match' : 'matches'}
          </span>
          <ChevronDown size={12} />
        </Button>
      )}
      {query && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Clear search"
          title="Clear query and results"
          className="search-clear"
          type="button"
          onClick={() => {
            clear();
            inputRef.current?.focus();
          }}
        >
          <X size={14} />
        </Button>
      )}
    </form>
  );
};
