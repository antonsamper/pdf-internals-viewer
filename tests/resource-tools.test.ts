import { describe, expect, it } from "vitest"
import {
  compareObjects,
  imagePlan,
  imageRgba,
  resourcePageAccess,
  samePdfValue,
} from "../src/lib/pdf/resource-tools"
import type {
  PdfDocumentInfo,
  PdfObjectRecord,
  PdfValue,
} from "../src/lib/pdf/types"
const name = (value: string): PdfValue => ({
  type: "name",
  value,
  text: `/${value}`,
})
const number = (value: number): PdfValue => ({
  type: "number",
  value,
  text: String(value),
})
const ref = (id: string): PdfValue => ({
  type: "reference",
  ref: id,
  text: `${id} R`,
})
const dictionary = (entries: Record<string, PdfValue>): PdfValue => ({
  type: "dictionary",
  entries: Object.entries(entries).map(([key, value]) => ({ key, value })),
  text: "<< >>",
})
const object = (
  id: string,
  entries: Record<string, PdfValue>
): PdfObjectRecord => ({
  id,
  objectNumber: 1,
  generation: 0,
  kind: "Dictionary",
  label: id,
  value: dictionary(entries),
  source: "",
  provenance: { type: "unknown", reason: "test" },
  references: [],
  referencedBy: [],
  warnings: [],
})
const image = (changes: Record<string, PdfValue> = {}) =>
  object("4 0", {
    Subtype: name("Image"),
    Width: number(2),
    Height: number(1),
    BitsPerComponent: number(8),
    ColorSpace: name("DeviceRGB"),
    ...changes,
  })
describe("object comparison", () => {
  it("compares semantic dictionary values regardless of key order while preserving types", () => {
    expect(
      samePdfValue(
        dictionary({ A: number(1), B: name("Hi") }),
        dictionary({ B: name("Hi"), A: number(1) })
      )
    ).toBe(true)
    expect(
      samePdfValue(name("Hi"), { type: "string", value: "Hi", text: "(Hi)" })
    ).toBe(false)
    expect(
      compareObjects(
        object("1 0", { A: number(1), Gone: name("old") }),
        object("2 0", { A: number(2), New: name("new") })
      ).map(({ key, status }) => [key, status])
    ).toEqual([
      ["A", "changed"],
      ["Gone", "removed"],
      ["New", "added"],
    ])
  })
  it("retains duplicate key occurrences", () => {
    const left = object("1 0", { A: number(1) }),
      right = object("2 0", { A: number(1) })
    if (left.value.type === "dictionary")
      left.value.entries.push({ key: "A", value: number(2) })
    expect(compareObjects(left, right).map((row) => row.status)).toEqual([
      "same",
      "removed",
    ])
  })
})
describe("bounded image previews", () => {
  it("produces accurate RGB and gray samples", () => {
    expect([
      ...imageRgba(imagePlan(image()), new Uint8Array([255, 0, 1, 2, 3, 4])),
    ]).toEqual([255, 0, 1, 255, 2, 3, 4, 255])
    expect([
      ...imageRgba(
        imagePlan(image({ ColorSpace: name("DeviceGray") })),
        new Uint8Array([10, 20])
      ),
    ]).toEqual([10, 10, 10, 255, 20, 20, 20, 255])
  })
  it("rejects masks, alternate decode, unsupported colors, oversized images and incomplete data before rendering", () => {
    for (const changes of [
      { Mask: ref("5 0") },
      { Decode: dictionary({}) },
      {
        ImageMask: { type: "boolean", value: false, text: "false" } as PdfValue,
      },
      { ColorSpace: name("DeviceCMYK") },
      { Width: number(20_000) },
      { Width: number(3000), Height: number(3000) },
    ])
      expect(() => imagePlan(image(changes))).toThrow()
    expect(() => imageRgba(imagePlan(image()), new Uint8Array(2))).toThrow(
      /length/
    )
  })
})
describe("resource page context", () => {
  it("follows inherited resources and nested forms without following Parent cycles", () => {
    const page = object("1 0", { Parent: ref("2 0") })
    const parent = object("2 0", { Resources: ref("3 0") })
    const resources = object("3 0", {
      XObject: dictionary({ Fm1: ref("4 0") }),
    })
    const form = object("4 0", {
      Subtype: name("Form"),
      Resources: dictionary({
        XObject: dictionary({ Im1: ref("5 0"), Loop: ref("4 0") }),
      }),
      Parent: ref("1 0"),
    })
    const img = image()
    img.id = "5 0"
    const objects = [page, parent, resources, form, img]
    const result = resourcePageAccess(
      { pages: ["1 0"], objects } as PdfDocumentInfo,
      new Map(objects.map((record) => [record.id, record]))
    )
    expect(result.pages.get("4 0")).toEqual([1])
    expect(result.pages.get("5 0")).toEqual([1])
    expect(result.incomplete).toBe(false)
  })
})
