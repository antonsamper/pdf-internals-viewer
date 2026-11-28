import type { SessionBookmark } from '@/components/session-bookmarks';

import type { ExplorationStep } from './exploration-trail';
import type { ByteRange } from './types';
export const documentBookmarkKey = async function documentBookmarkKey(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return (
    PREFIX +
    Array.from(new Uint8Array(digest), (b) => {
      return b.toString(16).padStart(2, '0');
    }).join('')
  );
};

const validBookmark = function validBookmark(value: unknown): value is SessionBookmark<BookmarkSelection> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const b = value as SessionBookmark<BookmarkSelection>;

  return (
    Number.isSafeInteger(b.key) && b.key > 0 && typeof b.label === 'string' && typeof b.note === 'string' && validSelection(b.selection)
  );
};

const validSelection = function validSelection(s: BookmarkSelection | undefined): boolean {
  return (
    !!s &&
    nullableString(s.id) &&
    ['properties', 'source', 'raw', 'decoded'].includes(s.tab) &&
    ['overview', 'catalog', 'pages', 'resources', 'objects', 'structure', 'issues', 'actions'].includes(s.section) &&
    (s.notice === undefined || typeof s.notice === 'string') &&
    validRange(s.range) &&
    validTrail(s.trail)
  );
};

const validRange = function validRange(range: ByteRange | undefined): boolean {
  return (
    range === undefined ||
    (!!range && Number.isSafeInteger(range.start) && range.start >= 0 && Number.isSafeInteger(range.end) && range.end > range.start)
  );
};

const validTrail = function validTrail(trail: ExplorationStep[] | undefined): boolean {
  return (
    trail === undefined ||
    (Array.isArray(trail) &&
      trail.every((step) => {
        return !!step && nullableString(step.id) && typeof step.label === 'string';
      }))
  );
};

const nullableString = function nullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
};

export const readBookmarks = function readBookmarks(key: string): SessionBookmark<BookmarkSelection>[] {
  const raw = localStorage.getItem(key);
  let stored: unknown;

  try {
    stored = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }

  if (!Array.isArray(stored)) {
    return [];
  }

  const keys = new Set<number>();

  return stored.filter(validBookmark).filter((bookmark) => {
    if (keys.has(bookmark.key)) {
      return false;
    }

    keys.add(bookmark.key);

    return true;
  });
};

export const writeBookmarks = function writeBookmarks(key: string, bookmarks: SessionBookmark<BookmarkSelection>[]) {
  try {
    if (bookmarks.length) {
      localStorage.setItem(key, JSON.stringify(bookmarks));
    } else {
      localStorage.removeItem(key);
    }

    return true;
  } catch {
    return false;
  }
};

export type BookmarkSelection = {
  id: string | null;
  tab: 'properties' | 'source' | 'raw' | 'decoded';
  section: 'overview' | 'catalog' | 'pages' | 'resources' | 'objects' | 'structure' | 'issues' | 'actions';
  range?: ByteRange;
  notice?: string;
  trail?: ExplorationStep[];
};
const PREFIX = 'pdf-internals:bookmarks:v1:';
