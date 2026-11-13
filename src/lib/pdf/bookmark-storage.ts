import type { SessionBookmark } from "@/components/session-bookmarks"
import type { ExplorationStep } from "./exploration-trail"
import type { ByteRange } from "./types"

export type BookmarkSelection = {
  id: string | null
  tab: "properties" | "source" | "raw" | "decoded"
  section:
    "overview" | "catalog" | "pages" | "resources" | "objects" | "structure"
  range?: ByteRange
  notice?: string
  trail?: ExplorationStep[]
}

const PREFIX = "pdf-internals:bookmarks:v1:"

export async function documentBookmarkKey(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return (
    PREFIX +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("")
  )
}

function validBookmark(
  value: unknown
): value is SessionBookmark<BookmarkSelection> {
  if (!value || typeof value !== "object") return false
  const b = value as SessionBookmark<BookmarkSelection>
  const s = b.selection
  return (
    Number.isSafeInteger(b.key) &&
    b.key > 0 &&
    typeof b.label === "string" &&
    typeof b.note === "string" &&
    !!s &&
    (s.id === null || typeof s.id === "string") &&
    ["properties", "source", "raw", "decoded"].includes(s.tab) &&
    [
      "overview",
      "catalog",
      "pages",
      "resources",
      "objects",
      "structure",
    ].includes(s.section) &&
    (s.notice === undefined || typeof s.notice === "string") &&
    (s.range === undefined ||
      (!!s.range &&
        Number.isSafeInteger(s.range.start) &&
        s.range.start >= 0 &&
        Number.isSafeInteger(s.range.end) &&
        s.range.end > s.range.start)) &&
    (s.trail === undefined ||
      (Array.isArray(s.trail) &&
        s.trail.every(
          (step) =>
            !!step &&
            (step.id === null || typeof step.id === "string") &&
            typeof step.label === "string"
        )))
  )
}

export function readBookmarks(
  key: string
): SessionBookmark<BookmarkSelection>[] {
  const raw = localStorage.getItem(key)
  let stored: unknown
  try {
    stored = JSON.parse(raw ?? "[]")
  } catch {
    return []
  }
  if (!Array.isArray(stored)) return []
  const keys = new Set<number>()
  return stored.filter(validBookmark).filter((bookmark) => {
    if (keys.has(bookmark.key)) return false
    keys.add(bookmark.key)
    return true
  })
}

export function writeBookmarks(
  key: string,
  bookmarks: SessionBookmark<BookmarkSelection>[]
) {
  try {
    if (bookmarks.length) localStorage.setItem(key, JSON.stringify(bookmarks))
    else localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
