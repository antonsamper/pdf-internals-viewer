import { cn } from 'cn';
import { Bookmark, Trash2 } from 'lucide-react';

import { ReferenceButton } from '@/components/inspector/reference-button';
import { Button } from '@/components/ui/button';
export const SessionBookmarks = function SessionBookmarks<T>({
  bookmarks,
  saved,
  onVisit,
  onNote,
  onRemove,
}: {
  saved: boolean;
  bookmarks: SessionBookmark<T>[];
  onVisit: (selection: T) => void;
  onNote: (key: number, note: string) => void;
  onRemove: (key: number) => void;
}) {
  return (
    <section className="max-h-[35%] shrink-0 overflow-auto border-t px-3 py-3" aria-label="Bookmarks">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-[550]">
        <Bookmark size={13} />
        Bookmarks <span className="text-muted-foreground">{bookmarks.length}</span>
      </h2>
      <p className="mb-2 text-xs leading-relaxed text-muted-foreground" role="status">
        {saved ? 'Saved in this browser for this PDF.' : 'Browser storage unavailable. Bookmarks are kept only while this file is open.'}
      </p>
      {!bookmarks.length && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Bookmark an object or byte range to return to it later. Add a note to record what you find.
        </p>
      )}
      <ul className="space-y-3">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.key} className="min-w-0">
            <div className="flex items-start gap-1">
              <ReferenceButton
                className="min-w-0 flex-1 text-left break-words whitespace-normal"
                onClick={() => onVisit(bookmark.selection)}
              >
                {bookmark.label}
              </ReferenceButton>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove bookmark ${bookmark.label}`}
                onClick={() => onRemove(bookmark.key)}
              >
                <Trash2 size={13} />
              </Button>
            </div>
            <label className="mt-1 block text-xs text-muted-foreground" htmlFor={`bookmark-note-${bookmark.key}`}>
              Note for {bookmark.label}
            </label>
            <textarea
              id={`bookmark-note-${bookmark.key}`}
              value={bookmark.note}
              maxLength={2000}
              rows={2}
              placeholder="Add a note…"
              className={cn(
                'mt-1 block w-full px-2 py-1',
                'bg-background text-xs text-foreground',
                'resize-y rounded-md border',
                'focus-visible:outline-2 focus-visible:outline-ring'
              )}
              onChange={(event) => onNote(bookmark.key, event.target.value)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};
export interface SessionBookmark<T> {
  key: number;
  label: string;
  selection: T;
  note: string;
}
