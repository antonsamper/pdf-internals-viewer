import { afterEach, describe, expect, it, vi } from "vitest"
import {
  documentBookmarkKey,
  readBookmarks,
  writeBookmarks,
} from "../src/lib/pdf/bookmark-storage"

const bookmark = {
  key: 1,
  label: "3 0 obj",
  note: "Follow contents",
  selection: {
    id: "3 0",
    tab: "properties",
    section: "pages",
    trail: [{ id: "3 0", label: "Page 1" }],
  },
} as const

afterEach(() => vi.unstubAllGlobals())

describe("bookmark storage", () => {
  it("keys by exact bytes independently of the filename", async () => {
    const first = await documentBookmarkKey(new Uint8Array([1, 2, 3]))
    expect(await documentBookmarkKey(new Uint8Array([1, 2, 3]))).toBe(first)
    expect(await documentBookmarkKey(new Uint8Array([1, 2, 4]))).not.toBe(first)
  })

  it("ignores invalid selections and duplicate keys in stored data", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          bookmark,
          bookmark,
          {
            ...bookmark,
            key: 2,
            selection: { ...bookmark.selection, trail: [null] },
          },
          {
            ...bookmark,
            key: 3,
            selection: { ...bookmark.selection, range: { start: -1, end: 2 } },
          },
        ]),
    })
    expect(readBookmarks("document")).toEqual([bookmark])
  })

  it("ignores malformed stored JSON", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{broken" })
    expect(readBookmarks("document")).toEqual([])
  })

  it("reports blocked storage and quota failures without throwing", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("Quota exceeded")
      },
    })
    expect(
      writeBookmarks("document", [JSON.parse(JSON.stringify(bookmark))])
    ).toBe(false)
  })

  it("removes the storage entry when the final bookmark is removed", () => {
    const removeItem = vi.fn()
    vi.stubGlobal("localStorage", { removeItem })
    expect(writeBookmarks("document", [])).toBe(true)
    expect(removeItem).toHaveBeenCalledWith("document")
  })
})
