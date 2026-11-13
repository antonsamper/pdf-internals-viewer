import { describe, expect, it } from "vitest"
import {
  extendExplorationTrail,
  referencePathOwners,
} from "../src/lib/pdf/exploration-trail"

describe("exploration trail", () => {
  it("preserves the exact key and index route across direct dictionaries", () => {
    const source = { id: "3 0", label: "Page 1" }
    expect(
      extendExplorationTrail([], source, { id: "8 0", label: "8 0 obj" }, [
        "/Resources",
        "/Font",
        "/F1",
      ])
    ).toEqual([
      source,
      { id: "3 0", label: "/Resources" },
      { id: "3 0", label: "/Font" },
      { id: "3 0", label: "/F1" },
      { id: "8 0", label: "8 0 obj" },
    ])
  })

  it("keeps repeated graph visits rather than claiming a unique parent", () => {
    const trail = [
      { id: "3 0", label: "Page 1" },
      { id: "8 0", label: "8 0 obj" },
    ]
    const extended = extendExplorationTrail(trail, trail[1], trail[0], [
      "/Parent",
    ])
    expect(extended.map((step) => step.id)).toEqual([
      "3 0",
      "8 0",
      "8 0",
      "3 0",
    ])
    expect(trail).toHaveLength(2)
  })

  it("can branch from an earlier breadcrumb without carrying abandoned descendants", () => {
    const trail = [
      { id: "3 0", label: "Page 1" },
      { id: "8 0", label: "8 0 obj" },
      { id: "9 0", label: "9 0 obj" },
    ]
    const extended = extendExplorationTrail(
      trail.slice(0, 1),
      trail[0],
      { id: "12 0", label: "12 0 obj" },
      ["/Contents", "[0]"]
    )
    expect(extended.map((step) => step.label)).toEqual([
      "Page 1",
      "/Contents",
      "[0]",
      "12 0 obj",
    ])
  })
})

it("resolves key ownership through inline-expanded indirect dictionaries", () => {
  const map = new Map([
    [
      "4 0",
      {
        value: {
          type: "dictionary",
          entries: [
            {
              key: "Font",
              value: {
                type: "dictionary",
                entries: [
                  {
                    key: "F1",
                    value: { type: "reference", ref: "8 0", text: "8 0 R" },
                  },
                ],
                text: "",
              },
            },
          ],
          text: "",
        },
      },
    ],
  ])
  const root = {
    type: "dictionary",
    entries: [
      {
        key: "Resources",
        value: { type: "reference", ref: "4 0", text: "4 0 R" },
      },
    ],
    text: "",
  }
  expect(
    referencePathOwners(
      root as Parameters<typeof referencePathOwners>[0],
      ["/Resources", "/Font", "/F1"],
      map as Parameters<typeof referencePathOwners>[2],
      "3 0"
    )
  ).toEqual(["3 0", "4 0", "4 0"])
})
