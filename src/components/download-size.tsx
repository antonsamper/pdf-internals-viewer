import { useEffect, useState } from "react"
import { fileSize } from "@/lib/file-size"
import { useVisible } from "@/lib/use-visible"
import type { StreamResult } from "@/lib/pdf/types"

export function DownloadSize({
  id,
  extractStream,
}: {
  id: string
  extractStream: (
    id: string,
    purpose?: "download" | "size"
  ) => Promise<StreamResult>
}) {
  const { ref, visible } = useVisible()
  const [size, setSize] = useState<number>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!visible) return
    let active = true
    extractStream(id, "size")
      .then((result) => {
        if (!active) return
        if (result.error || result.byteLength === undefined)
          setError(result.error ?? "The complete size could not be determined.")
        else setSize(result.byteLength)
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not determine the size."
          )
      })
    return () => {
      active = false
    }
  }, [id, extractStream, visible])
  return (
    <div
      ref={ref}
      className="download-size"
      title={
        error ??
        (size !== undefined ? `${size.toLocaleString()} bytes` : undefined)
      }
    >
      {error
        ? `Download size unavailable: ${error}`
        : size !== undefined
          ? `Download: ${fileSize(size)}`
          : "Calculating download size…"}
    </div>
  )
}
