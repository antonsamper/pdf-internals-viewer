import { useEffect, useRef, useState } from "react"
import { Download, LoaderCircle, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { imageDownloadPlan } from "@/lib/pdf/image-download"
import {
  buildImageFile,
  imageThumbnail,
  queueImageWork,
} from "@/lib/image-export"
import { fileSize } from "@/lib/file-size"
import { useVisible } from "@/lib/use-visible"
import { saveFile } from "@/lib/save-file"
import type { PdfObjectRecord, StreamResult } from "@/lib/pdf/types"

const message = (reason: unknown) =>
  (reason instanceof Error
    ? reason.message
    : "The browser could not process this image."
  ).replace(/^(Thumbnail|Image export) unavailable:\s*/, "")

export function ImageDownload({
  object,
  extractImage,
  showPreview = false,
}: {
  object: PdfObjectRecord
  extractImage: (id: string) => Promise<StreamResult>
  showPreview?: boolean
}) {
  const { ref, visible } = useVisible()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<{
    size?: number
    image?: string
    previewError?: string
    exportError?: string
  }>({})
  const request = useRef(0)
  useEffect(
    () => () => {
      request.current++
    },
    [object]
  )
  let plan: ReturnType<typeof imageDownloadPlan> | undefined
  let unavailable: string | undefined
  try {
    plan = imageDownloadPlan(object)
  } catch (reason) {
    unavailable = message(reason)
  }

  useEffect(() => {
    if (!visible) return
    let active = true
    void queueImageWork(async () => {
      if (!active) return
      try {
        const file = await buildImageFile(object, extractImage)
        if (!active) return
        let image: string | undefined
        let previewError: string | undefined
        if (showPreview) {
          try {
            image = await imageThumbnail(object, file.blob)
          } catch (reason) {
            previewError = message(reason)
          }
        }
        if (active) setState({ size: file.blob.size, image, previewError })
      } catch (reason) {
        if (active)
          setState({
            exportError: message(reason),
            previewError: message(reason),
          })
      }
    })
    return () => {
      active = false
    }
  }, [object, extractImage, showPreview, visible])

  async function download() {
    if (!plan) return
    const token = ++request.current
    setPending(true)
    setError(null)
    try {
      await queueImageWork(async () => {
        if (request.current !== token) return
        const file = await buildImageFile(object, extractImage)
        if (request.current === token) {
          saveFile(file.blob, file.filename)
          setState((current) => ({ ...current, size: file.blob.size }))
        }
      })
    } catch (reason) {
      if (request.current === token) setError(message(reason))
    } finally {
      if (request.current === token) setPending(false)
    }
  }
  const previewError = unavailable ?? state.previewError
  const downloadError = error ?? state.exportError
  const showDownloadError =
    downloadError &&
    downloadError !== unavailable &&
    (!showPreview || downloadError !== previewError)
  return (
    <div className="image-download" ref={ref}>
      {showPreview &&
        (state.image ? (
          <img
            src={state.image}
            alt={`Image object ${object.id}`}
            className="resource-image-preview"
          />
        ) : (
          <div className="resource-image-placeholder" role="status">
            {previewError ? (
              <>
                <ImageOff aria-hidden="true" />
                <p>Preview unavailable: {previewError}</p>
              </>
            ) : (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
                <p>Loading image preview…</p>
              </>
            )}
          </div>
        ))}
      <div
        className="image-file-size"
        title={
          state.size !== undefined
            ? `${state.size.toLocaleString()} bytes`
            : undefined
        }
      >
        {state.size !== undefined
          ? `Download: ${fileSize(state.size)}`
          : unavailable || state.exportError
            ? "Download size unavailable"
            : "Calculating download size…"}
        {object.stream && (
          <span> · In PDF: {fileSize(object.stream.length)}</span>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || !plan}
        onClick={() => void download()}
      >
        {pending ? (
          <LoaderCircle
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Download aria-hidden="true" />
        )}
        {pending ? "Exporting image…" : "Download image"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        {unavailable
          ? `Image export unavailable: ${unavailable}`
          : plan?.format === "jpeg"
            ? "JPEG · embedded file, without page masks, color adjustments, or transforms."
            : "PNG · full image dimensions, without page transforms. Up to 4 megapixels / 4096 pixels per side."}
      </p>
      {showDownloadError && (
        <p role="alert" className="warning-inline">
          {downloadError}
        </p>
      )}
    </div>
  )
}
