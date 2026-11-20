import type { PageTreeState } from '@/components/page-tree';
import type { BookmarkSelection } from '@/lib/pdf/bookmark-storage';
import type { ScrollPosition } from '@/lib/scroll-restoration';

export type Selection = BookmarkSelection;
export type Section = 'overview' | 'catalog' | 'pages' | 'resources' | 'objects' | 'structure' | 'issues';
export type { SearchResult } from '@/lib/pdf/document-search';
export const EMPTY = new Uint8Array();
export const emptyPageTree = (): PageTreeState => ({ expanded: new Set(), limits: {} });
export const newViewports = () => ({
  bytes: {} as ScrollPosition,
  inspector: {} as ScrollPosition,
  issueLimit: 50,
  resourceLimit: 50,
});
export const size = (value: number) =>
  value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
