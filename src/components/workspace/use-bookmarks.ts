import { useEffect, useRef, useState } from 'react';

import type { SessionBookmark } from '@/components/session-bookmarks';

import { documentBookmarkKey, readBookmarks, writeBookmarks } from '@/lib/pdf/bookmark-storage';

import type { Selection } from './types';

/** Session bookmarks for the open document, synchronised across browser tabs. */
export const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<SessionBookmark<Selection>[]>([]);
  const activeStorageKey = useRef<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) {
        return;
      }

      try {
        setBookmarks(readBookmarks(storageKey));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    };

    window.addEventListener('storage', sync);

    return () => {
      return window.removeEventListener('storage', sync);
    };
  }, [storageKey]);

  const update = (mutate: (current: SessionBookmark<Selection>[]) => SessionBookmark<Selection>[]) => {
    const key = storageKey;
    const apply = () => {
      if (activeStorageKey.current !== key) {
        return;
      }

      let current = bookmarks;

      if (key && saved) {
        try {
          current = readBookmarks(key);
        } catch {}
      }

      const next = mutate(current);

      setBookmarks(next);
      setSaved(key ? writeBookmarks(key, next) : false);
    };

    // Serialize edits across tabs, reading the latest snapshot inside the lock.
    if (key && navigator.locks) {
      void navigator.locks.request(key, apply);
    } else {
      apply();
    }
  };

  const add = (selection: Selection) => {
    if (!selection.id && !selection.range) {
      return;
    }

    const rangeLabel = selection.range
      ? `Bytes 0x${selection.range.start.toString(16).toUpperCase()}–0x${(selection.range.end - 1).toString(16).toUpperCase()}`
      : '';
    const label = rangeLabel || `${selection.id} obj · ${selection.tab}`;

    update((current) => {
      return current.concat({
        key:
          current.reduce((max, item) => {
            return Math.max(max, item.key);
          }, 0) + 1,
        label,
        note: '',
        selection: { ...selection },
      });
    });
  };

  /** Resolves false when the request was superseded while the key was computed. */
  const load = async (original: Uint8Array<ArrayBuffer>, isCurrent: () => boolean) => {
    try {
      const key = await documentBookmarkKey(original);

      if (!isCurrent()) {
        return false;
      }

      const stored = readBookmarks(key);

      activeStorageKey.current = key;
      setBookmarks(stored);
      setStorageKey(key);
    } catch {
      if (!isCurrent()) {
        return false;
      }

      setSaved(false);
    }

    return true;
  };

  const reset = () => {
    activeStorageKey.current = null;
    setStorageKey(null);
    setSaved(true);
    setBookmarks([]);
  };

  return {
    add,
    bookmarks,
    load,
    remove: (key: number) => {
      return update((current) => {
        return current.filter((bookmark) => {
          return bookmark.key !== key;
        });
      });
    },
    reset,
    saved,
    setNote: (key: number, note: string) => {
      return update((current) => {
        return current.map((bookmark) => {
          return bookmark.key === key ? { ...bookmark, note } : bookmark;
        });
      });
    },
  };
};
