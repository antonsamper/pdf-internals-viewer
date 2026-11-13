import { FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import { inspectionFailure } from "@/lib/pdf/failure"

export function InspectionUnavailable({
  reason,
  onOpenFile,
  onShowBytes,
}: {
  reason?: string
  onOpenFile: () => void
  onShowBytes: () => void
}) {
  const failure = inspectionFailure(reason)
  return (
    <section
      aria-label="Why structure is unavailable"
      className="inspection-unavailable"
    >
      <FileWarning size={24} aria-hidden="true" />
      <h2>{failure.title}</h2>
      <p>{failure.explanation}</p>
      <p>{failure.suggestion}</p>
      <p>
        Original file bytes are still available. A parsing failure does not
        confirm password protection.
      </p>
      {reason && (
        <details className="inspection-error-details">
          <summary>Technical details</summary>
          <pre>{reason}</pre>
        </details>
      )}
      <div className="overview-actions">
        <Button variant="outline" onClick={onShowBytes}>
          Inspect original bytes
        </Button>
        <Button variant="outline" onClick={onOpenFile}>
          Open another PDF
        </Button>
      </div>
    </section>
  )
}
