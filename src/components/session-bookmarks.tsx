import { Bookmark, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SessionBookmark<T> {
  key: number
  label: string
  selection: T
  note: string
}

export function SessionBookmarks<T>({
  bookmarks,
  onVisit,
  onNote,
  onRemove,
}: {
  bookmarks: SessionBookmark<T>[]
  onVisit: (selection: T) => void
  onNote: (key: number, note: string) => void
  onRemove: (key: number) => void
}) {
  return (
    <section
      className="session-bookmarks border-t px-3 py-3"
      aria-label="Session bookmarks"
    >
      <h2 className="mb-2 flex items-center gap-2 text-xs font-medium">
        <Bookmark size={13} />
        Bookmarks{" "}
        <span className="text-muted-foreground">{bookmarks.length}</span>
      </h2>
      {!bookmarks.length && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Bookmark an object or byte range to keep it here while this file is
          open.
        </p>
      )}
      <ul className="space-y-3">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.key} className="min-w-0">
            <div className="flex items-start gap-1">
              <button
                className="reference min-w-0 flex-1 text-left text-xs break-words"
                onClick={() => onVisit(bookmark.selection)}
              >
                {bookmark.label}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove bookmark ${bookmark.label}`}
                onClick={() => onRemove(bookmark.key)}
              >
                <Trash2 size={13} />
              </Button>
            </div>
            <label
              className="mt-1 block text-xs text-muted-foreground"
              htmlFor={`bookmark-note-${bookmark.key}`}
            >
              Note for {bookmark.label}
            </label>
            <textarea
              id={`bookmark-note-${bookmark.key}`}
              value={bookmark.note}
              maxLength={2000}
              rows={2}
              placeholder="Add a note…"
              className="mt-1 block w-full resize-y rounded-md border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onChange={(event) => onNote(bookmark.key, event.target.value)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
