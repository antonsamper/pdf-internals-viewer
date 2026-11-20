import { useEffect, useEffectEvent, type RefObject } from 'react';

import { ALL_SAMPLES } from '@/lib/site-content';

/** ⌘/Ctrl+O opens a file; ⌘/Ctrl+K focuses the search box. */
export const useWorkspaceShortcuts = (
  openFile: () => void,
  searchInput: RefObject<HTMLInputElement | null>,
  setSearchOpen: (open: boolean) => void
) => {
  const open = useEffectEvent(openFile);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === 'o') {
        event.preventDefault();
        open();
      }
      if (event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchInput, setSearchOpen]);
};

/** Opens the `?sample=` document named in the address bar, once, for a fresh session. */
export const useInitialSample = (enabled: boolean, openSample: (file: string) => void) => {
  const open = useEffectEvent(openSample);
  useEffect(() => {
    if (!enabled) return;
    const id = new URLSearchParams(window.location.search).get('sample');
    const selectedSample = ALL_SAMPLES.find((item) => item.id === id);
    if (!selectedSample) return;
    const timer = window.setTimeout(() => open(selectedSample.file), 0);
    return () => window.clearTimeout(timer);
  }, [enabled]);
};
