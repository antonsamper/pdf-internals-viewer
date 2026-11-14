import { useEffect, useRef, useState } from "react"
import { Download, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveFile } from "@/lib/save-file"
import { DownloadSize } from "@/components/download-size"
import type { EmbeddedDownload } from "@/lib/pdf/downloads"
import type { PdfObjectRecord, StreamResult } from "@/lib/pdf/types"

export function EmbeddedDownloads({
  object,
  assets,
  extractStream,
}: {
  object: PdfObjectRecord
  assets: EmbeddedDownload[]
  extractStream: (
    id: string,
    purpose?: "download" | "size"
  ) => Promise<StreamResult>
}) {
  const request = useRef(0)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () => () => {
      request.current++
    },
    [object]
  )

  async function download(asset: EmbeddedDownload) {
    const token = ++request.current
    setPending(asset.streamId)
    setError(null)
    try {
      const result = await extractStream(asset.streamId)
      if (token !== request.current) return
      if (result.error) throw new Error(result.error)
      if (result.truncated)
        throw new Error("The stream is incomplete. No file was downloaded.")
      saveFile(
        new Blob([new Uint8Array(result.bytes)], {
          type: "application/octet-stream",
        }),
        asset.filename
      )
    } catch (reason) {
      if (token === request.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not extract the embedded file."
        )
    } finally {
      if (token === request.current) setPending(null)
    }
  }
  const hasFont = assets.some((asset) => asset.kind === "font")
  return (
    <section
      className="embedded-downloads"
      aria-label="Embedded file downloads"
    >
      {assets.map((asset) => (
        <div
          className="embedded-download-row"
          key={`${asset.kind}-${asset.streamId}-${asset.filename}`}
        >
          <div>
            <strong>{asset.filename}</strong>
            <span>
              {asset.kind === "font"
                ? asset.subset
                  ? "Embedded font · subset indicated"
                  : "Embedded font"
                : "Embedded attachment"}
            </span>
            <DownloadSize id={asset.streamId} extractStream={extractStream} />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => void download(asset)}
          >
            {pending === asset.streamId ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Download aria-hidden="true" />
            )}
            {pending === asset.streamId
              ? "Extracting…"
              : asset.kind === "font"
                ? "Download font"
                : "Download attachment"}
          </Button>
        </div>
      ))}
      {hasFont && (
        <p className="representation-note">
          Fonts may be partial: an embedded font can contain only the characters
          used in this PDF. Downloading it does not restore the complete
          original font. Some extracted font programs are not directly
          installable.
        </p>
      )}
      {error && (
        <p className="warning-inline" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
