import { describe, expect, it } from "vitest"
import {
  contentInstructions,
  explainInstruction,
  namedResource,
  resourceCategory,
  resourceContexts,
} from "../src/lib/pdf/content-stream"
import type { PdfObjectRecord, PdfValue } from "../src/lib/pdf/types"

const dict = (entries: Record<string, PdfValue>): PdfValue => ({
  type: "dictionary",
  entries: Object.entries(entries).map(([key, value]) => ({ key, value })),
  text: "<<>>",
})
const ref = (id: string): PdfValue => ({
  type: "reference",
  ref: id,
  text: `${id} R`,
})
const name = (value: string): PdfValue => ({
  type: "name",
  value,
  text: `/${value}`,
})
const record = (id: string, value: PdfValue): PdfObjectRecord => ({
  id,
  objectNumber: Number(id.split(" ")[0]),
  generation: 0,
  kind: "Dictionary",
  label: id,
  value,
  source: "",
  provenance: { type: "unknown", reason: "test" },
  references: [],
  referencedBy: [],
  warnings: [],
})

describe("content instruction interpretation", () => {
  it("keeps operators in strings, arrays, dictionaries, hex data and comments opaque", () => {
    const text =
      "% fake /Wrong 99 Tf\nBT /F1 12 Tf (Hello \\( nested (Tf) text) Tj [(Do) -12 <5466>] TJ /Tag << /ActualText (Tf) >> BDC ET"
    const parsed = contentInstructions(text)
    expect(parsed.instructions.map((row) => row.operator)).toEqual([
      "BT",
      "Tf",
      "Tj",
      "TJ",
      "BDC",
      "ET",
    ])
    const font = parsed.instructions[1]
    expect(text.slice(font.start, font.end)).toBe("/F1 12 Tf")
    expect(explainInstruction(font)).toBe("Select font /F1 at size 12.")
    expect(parsed.incomplete).toBe(false)
  })
  it("stops at opaque inline images instead of treating image bytes as instructions", () => {
    const parsed = contentInstructions("q BI /W 1 /H 1 ID /Fake 12 Tf EI Q")
    expect(parsed.instructions.map((row) => row.operator)).toEqual(["q", "BI"])
    expect(parsed.instructions[1].warning).toContain("opaque")
    expect(parsed.incomplete).toBe(true)
  })
  it("reports malformed/truncated values and unknown operators without claiming meaning", () => {
    expect(contentInstructions("BT (unfinished").incomplete).toBe(true)
    expect(contentInstructions("[1 2").incomplete).toBe(true)
    expect(
      explainInstruction(contentInstructions("1 mystery").instructions[0])
    ).toContain("Unknown or unsupported")
    expect(contentInstructions("q Q q Q", 2).incomplete).toBe(true)
  })
  it("bounds deeply nested values and operand-heavy inputs", () => {
    expect(
      contentInstructions("[".repeat(12000) + "0" + "]".repeat(12000) + " TJ")
        .instructions[0].operator
    ).toBe("TJ")
    const parsed = contentInstructions("1 ".repeat(20000) + "m")
    expect(parsed.incomplete).toBe(true)
    expect(parsed.instructions[0].tokens.length).toBeLessThanOrEqual(5000)
  })
})

describe("content resource provenance", () => {
  const fontA = record("8 0", dict({ BaseFont: name("Helvetica") }))
  const fontB = record("9 0", dict({ BaseFont: name("Courier") }))
  const parent = record("2 0", dict({ Resources: ref("3 0") }))
  const resourcesA = record("3 0", dict({ Font: ref("4 0") }))
  const fonts = record("4 0", dict({ F1: ref(fontA.id) }))
  const pageA = record(
    "5 0",
    dict({ Parent: ref(parent.id), Contents: ref("10 0") })
  )
  const pageB = record(
    "6 0",
    dict({
      Resources: dict({ Font: dict({ F1: ref(fontB.id) }) }),
      Contents: ref("7 0"),
    })
  )
  const contentArray = record("7 0", {
    type: "array",
    items: [ref("10 0")],
    text: "[]",
  })
  const stream = record("10 0", dict({}))
  const map = new Map(
    [
      fontA,
      fontB,
      parent,
      resourcesA,
      fonts,
      pageA,
      pageB,
      contentArray,
      stream,
    ].map((object) => [object.id, object])
  )
  const pages = [pageA.id, pageB.id]

  it("preserves distinct page scopes for a shared content stream, including inherited and indirect resources", () => {
    const contexts = resourceContexts(stream, map, pages)
    expect(contexts.map((context) => context.id)).toEqual(pages)
    expect(namedResource(contexts[0], "Font", "/F#31", map)?.id).toBe(fontA.id)
    expect(namedResource(contexts[1], "Font", "/F1", map)?.id).toBe(fontB.id)
    expect(resourceContexts(stream, map, pages, pageB.id)[0].id).toBe(pageB.id)
  })
  it("uses form-owned resources and never guesses missing nested invocation resources from a page", () => {
    const form = record(
      "11 0",
      dict({
        Subtype: name("Form"),
        Resources: dict({ Font: dict({ F1: ref(fontB.id) }) }),
      })
    )
    expect(
      namedResource(
        resourceContexts(form, map, pages, pageA.id)[0],
        "Font",
        "/F1",
        map
      )?.id
    ).toBe(fontB.id)
    const unknown = record("12 0", dict({ Subtype: name("Form") }))
    expect(
      resourceContexts(unknown, map, pages, pageA.id)[0].resources
    ).toBeUndefined()
    expect(resourceContexts(unknown, map, pages, pageA.id)[0].label).toContain(
      "unknown"
    )
  })
  it("does not interpret arbitrary streams and does not invent missing/cyclic resources", () => {
    expect(
      resourceContexts(
        record("13 0", dict({ Subtype: name("Image") })),
        map,
        pages
      )
    ).toEqual([])
    const cyclic = new Map(map).set("14 0", record("14 0", ref("14 0")))
    expect(
      namedResource(
        { id: "context", label: "test", resources: ref("14 0"), path: [] },
        "Font",
        "/F1",
        cyclic
      )
    ).toBeUndefined()
    expect(
      namedResource(
        resourceContexts(stream, map, pages)[0],
        "Font",
        "/Missing",
        map
      )
    ).toBeUndefined()
    expect(resourceCategory("Tf", 0, 2)).toBe("Font")
    expect(resourceCategory("BDC", 0, 2)).toBeUndefined()
    expect(resourceCategory("BDC", 1, 2)).toBe("Properties")
  })
})
