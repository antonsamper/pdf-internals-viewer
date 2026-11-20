import { describe, expect, it } from "vitest"
import {
  diagnosticIssue,
  documentIssues,
  issueSummary,
} from "../src/lib/pdf/issues"
import { PdfInspector } from "../src/lib/pdf/inspector"
// @ts-expect-error local JavaScript fixtures have no declarations
import { classicPdf, minimalPdf } from "../scripts/fixtures/pdf-fixtures.mjs"

describe("PDF diagnostics", () => {
  it("reports a clean parse without claiming validation", async () => {
    const document = await new PdfInspector().open(minimalPdf().bytes)
    expect(issueSummary(documentIssues(document))).toBe(
      "No issues detected by these checks."
    )
  })
  it("retains recovery evidence", async () => {
    const fixture = minimalPdf()
    const document = await new PdfInspector().open(
      fixture.bytes.slice(0, fixture.xref)
    )
    expect(documentIssues(document)).toContainEqual(
      expect.objectContaining({
        title: "Damaged cross-references recovered",
        severity: "warning",
      })
    )
  })
  it("links dangling reference findings to the referring object, not the missing target", async () => {
    const fixture = classicPdf([
      [1, "<< /Type /Catalog /Pages 2 0 R /Missing 99 0 R >>"],
      [2, "<< /Type /Pages /Kids [] /Count 0 >>"],
    ])
    const document = await new PdfInspector().open(fixture.bytes)
    const issues = documentIssues(document)
    expect(issues).toContainEqual(
      expect.objectContaining({
        objectId: "1 0",
        title: "Unresolved object reference",
        evidence: "Dangling or unresolved reference: 99 0 R",
      })
    )
    document.objects[0].warnings.push(...document.objects[0].warnings)
    expect(documentIssues(document)).toEqual(issues)
  })
  it("separates inspection limitations and informational notes from PDF errors", () => {
    for (const evidence of [
      "Decoded inspection does not support /DCTDecode. Raw stream bytes remain available.",
      "Decoded stream exceeds the 32 MiB inspection limit.",
      "The encryption information is invalid or unsupported. Try an unencrypted copy.",
      "PDF parser worker failed.",
    ])
      expect(diagnosticIssue(evidence).severity).toBe("limitation")
    expect(
      diagnosticIssue("Encrypted document unlocked locally.").severity
    ).toBe("info")
    expect(
      diagnosticIssue("Cross-reference target has a different object identity.")
        .severity
    ).toBe("error")
    expect(diagnosticIssue("Something unexpected").severity).toBe("warning")
  })
})
