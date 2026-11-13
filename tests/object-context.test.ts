import { describe, expect, it } from "vitest"
import { PdfInspector } from "../src/lib/pdf/inspector"
import {
  objectRelationships,
  objectSummary,
  referencePaths,
} from "../src/lib/pdf/object-context"
import type { PdfObjectRecord, PdfValue } from "../src/lib/pdf/types"
// @ts-expect-error shared JavaScript fixture generator
import {
  minimalPdf,
  resourcesPdf,
  classicPdf,
} from "../scripts/fixtures/pdf-fixtures.mjs"

async function inspect(bytes: Uint8Array) {
  const document = await new PdfInspector().open(bytes)
  const objects = new Map(document.objects.map((object) => [object.id, object]))
  return { document, objects }
}

describe("object explanations and labelled relationships", () => {
  it("preserves nested key and array paths, without following cycles", async () => {
    const { objects } = await inspect(
      classicPdf([
        [1, "<< /Type /Catalog /Pages 2 0 R >>"],
        [2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
        [
          3,
          "<< /Type /Page /Parent 2 0 R /Contents [4 0 R 4 0 R] /Resources << /Font << /F1 5 0 R >> >> >>",
        ],
        [4, "<< /Back 3 0 R >>"],
        [5, "<< /Type /Font >>"],
      ]).bytes
    )
    const links = referencePaths(objects.get("3 0")!).links
    expect(
      links.filter((link) => link.targetId === "4 0").map((link) => link.path)
    ).toEqual([
      ["/Contents", "[0]"],
      ["/Contents", "[1]"],
    ])
    expect(links.find((link) => link.targetId === "5 0")?.path).toEqual([
      "/Resources",
      "/Font",
      "/F1",
    ])
    expect(
      objectRelationships(objects.get("4 0")!, objects).incoming
    ).toHaveLength(2)
  })

  it("explains a known content stream and links back through /Contents", async () => {
    const { document, objects } = await inspect(minimalPdf().bytes)
    const stream = objects.get("4 0")!
    const relationships = objectRelationships(stream, objects)
    expect(relationships.incoming).toEqual([
      { sourceId: "3 0", targetId: "4 0", path: ["/Contents"] },
    ])
    expect(
      objectSummary(stream, document.pages, relationships.incoming, objects)
    ).toContain("content stream referenced by Page 1")
    // The inherited font belongs to the actual ancestor dictionary, not the leaf page.
    expect(objectRelationships(objects.get("5 0")!, objects).incoming).toEqual([
      {
        sourceId: "2 0",
        targetId: "5 0",
        path: ["/Resources", "/Font", "/F1"],
      },
    ])
  })

  it("describes images without claiming they are drawn", async () => {
    const { document, objects } = await inspect(resourcesPdf().bytes)
    const image = objects.get("6 0")!
    const summary = objectSummary(image, document.pages, [], objects)
    expect(summary).toContain("1 × 1 pixels")
    expect(summary).toContain("does not prove the image is drawn")
    expect(
      objectSummary(objects.get("5 0")!, document.pages, [], objects)
    ).toContain("font dictionary")
  })

  it("bounds wide and deeply nested values with an explicit incomplete result", () => {
    const ref: PdfValue = { type: "reference", ref: "2 0", text: "2 0 R" }
    const object = {
      id: "1 0",
      value: {
        type: "array",
        items: Array.from({ length: 1000 }, () => ref),
        text: "",
      },
    } as PdfObjectRecord
    const wide = referencePaths(object)
    expect(wide.links).toHaveLength(200)
    expect(wide.incomplete).toBe(true)
    let value = ref
    for (let i = 0; i < 40; i++)
      value = { type: "array", items: [value], text: "" }
    expect(referencePaths({ ...object, value }).incomplete).toBe(true)
  })
})
