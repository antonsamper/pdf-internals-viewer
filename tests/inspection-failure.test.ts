import { describe, expect, it } from "vitest"
import { inspectionFailure } from "../src/lib/pdf/failure"

describe("inspection failure hints", () => {
  it("explains timeouts and gives the actual processing limit", () => {
    const result = inspectionFailure(
      "PDF operation exceeded 15 seconds. Original bytes are still available; try a smaller file."
    )
    expect(result.title).toBe("Inspection timed out")
    expect(result.explanation).toContain("15-second")
    expect(result.suggestion).toContain("smaller document")
  })
  it("identifies resource limits separately from invalid documents", () => {
    expect(
      inspectionFailure("This PDF exceeds the 100,000 object inspection limit.")
        .title
    ).toBe("Inspection limit reached")
    expect(
      inspectionFailure("Decoded stream exceeds the 32 MiB inspection limit.")
        .title
    ).toBe("Inspection limit reached")
  })
  it("does not blame the PDF for a failed worker or module import", () => {
    for (const message of [
      "PDF parser worker failed.",
      "Failed to fetch dynamically imported module",
      "Module does not provide an export named 'Boolean'",
    ]) {
      const result = inspectionFailure(message)
      expect(result.title).toBe("PDF inspection engine unavailable")
      expect(result.explanation).toContain(
        "does not establish a problem with your PDF"
      )
      expect(result.suggestion).toContain("Reload")
    }
  })
  it("only reports an encryption limitation when the parser reported one", () => {
    expect(inspectionFailure("Unsupported encryption algorithm").title).toBe(
      "Encryption could not be opened"
    )
    expect(inspectionFailure("Password required").suggestion).toContain(
      "This encryption could not be processed"
    )
  })
  it("preserves uncertainty for unknown, malformed, or dismissed errors", () => {
    for (const message of [
      undefined,
      "Could not recover PDF structure: no objects found",
      "Unexpected parser response.",
    ]) {
      const result = inspectionFailure(message)
      expect(result.title).toBe("PDF structure could not be read")
      expect(result.explanation).toContain(
        "could not determine whether it is encrypted"
      )
      expect(result.suggestion).toContain("fresh copy")
    }
  })
})
