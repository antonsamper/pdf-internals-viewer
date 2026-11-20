import { describe, expect, it } from "vitest"
import { byteSearchSnippet } from "../src/lib/pdf/search-snippet"

const bytes = (value: string) =>
  Uint8Array.from(value, (char) => char.charCodeAt(0))
describe("search result context", () => {
  it("preserves the matched bytes while revealing nearby syntax and invisible bytes", () => {
    expect(byteSearchSnippet(bytes("BT\n(Hello) Tj"), 4, 9)).toEqual({
      before: "BT·(",
      match: "Hello",
      after: ") Tj",
    })
  })
  it("shows byte values for binary searches, including a match at the start or end of a file", () => {
    const value = new Uint8Array([0, 255, 37, 80])
    expect(byteSearchSnippet(value, 0, 2, true)).toEqual({
      before: "",
      match: "00 FF",
      after: " 25 50",
    })
    expect(byteSearchSnippet(value, 2, 4, true)).toEqual({
      before: "00 FF ",
      match: "25 50",
      after: "",
    })
  })
  it("bounds large matches and surrounding content without losing their real byte coordinates", () => {
    const snippet = byteSearchSnippet(
      bytes("a".repeat(100) + "B".repeat(200) + "c".repeat(100)),
      100,
      300
    )
    expect(snippet.before).toBe("…" + "a".repeat(32))
    expect(snippet.match).toBe("B".repeat(96) + "…")
    expect(snippet.after).toBe("c".repeat(32) + "…")
  })
})
