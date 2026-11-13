import { useEffect, useMemo, useRef, useState } from "react"
import { Image as ImageIcon, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { property } from "@/lib/pdf/navigation"
import {
  imagePlan,
  imageRgba,
  resourceKind,
  resourcePageAccess,
} from "@/lib/pdf/resource-tools"
import type {
  PdfDocumentInfo,
  PdfObjectRecord,
  StreamResult,
} from "@/lib/pdf/types"

function detail(object: PdfObjectRecord, key: string) {
  const value = property(object.value, key)
  return value?.text ?? "Not specified"
}
function ImageThumbnail({
  object,
  readStream,
}: {
  object: PdfObjectRecord
  readStream: (id: string, mode: "raw" | "decoded") => Promise<StreamResult>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<{
    image?: string
    error?: string
    loading?: boolean
  }>({})
  const request = useRef(0)
  useEffect(
    () => () => {
      request.current++
    },
    []
  )
  async function preview() {
    const token = ++request.current
    setState({ loading: true })
    try {
      const plan = imagePlan(object)
      // The parser enforces its decoded stream budget and returns a bounded display preview.
      const stream = await readStream(object.id, "decoded")
      if (request.current !== token) return
      if (stream.error) throw new Error(stream.error)
      if (stream.truncated)
        throw new Error(
          "Thumbnail unavailable: the decoded stream exceeds the bounded stream preview. Inspect the dictionary and stream instead."
        )
      const pixels = imageRgba(plan, stream.bytes)
      const surface = canvas.current
      if (!surface) return
      surface.width = plan.width
      surface.height = plan.height
      const context = surface.getContext("2d")
      if (!context)
        throw new Error("The browser could not create an image thumbnail.")
      const image = context.createImageData(plan.width, plan.height)
      image.data.set(pixels)
      context.putImageData(image, 0, 0)
      const thumbnail = document.createElement("canvas")
      const scale = Math.min(1, 160 / Math.max(plan.width, plan.height))
      thumbnail.width = Math.max(1, Math.round(plan.width * scale))
      thumbnail.height = Math.max(1, Math.round(plan.height * scale))
      const thumbnailContext = thumbnail.getContext("2d")
      if (!thumbnailContext)
        throw new Error("The browser could not create an image thumbnail.")
      thumbnailContext.drawImage(
        surface,
        0,
        0,
        thumbnail.width,
        thumbnail.height
      )
      setState({ image: thumbnail.toDataURL("image/png") })
      thumbnail.width = 0
      thumbnail.height = 0
    } catch (reason) {
      if (request.current === token)
        setState({
          error:
            reason instanceof Error
              ? reason.message
              : "Image thumbnail unavailable. Inspect the dictionary and stream instead.",
        })
    } finally {
      // Retain only a thumbnail, not a full-sized canvas backing store.
      if (canvas.current) {
        canvas.current.width = 0
        canvas.current.height = 0
      }
    }
  }
  return (
    <div className="my-3">
      <canvas ref={canvas} hidden />
      {state.image ? (
        <img
          src={state.image}
          alt={`Image object ${object.id}`}
          className="my-2 h-40 w-40 max-w-full border bg-white object-contain [image-rendering:pixelated]"
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void preview()}
          disabled={state.loading}
        >
          <ImageIcon size={14} />
          {state.loading ? (
            <>
              <LoaderCircle
                size={14}
                className="animate-spin motion-reduce:animate-none"
              />
              Reading image…
            </>
          ) : (
            `Preview image ${object.id}`
          )}
        </Button>
      )}
      {state.error && (
        <p
          role="status"
          className="mt-2 max-w-prose text-xs text-muted-foreground"
        >
          {state.error}
        </p>
      )}
    </div>
  )
}
export function ResourceBrowser({
  document,
  objectMap,
  readStream,
  onNavigate,
}: {
  document: PdfDocumentInfo
  objectMap: Map<string, PdfObjectRecord>
  readStream: (id: string, mode: "raw" | "decoded") => Promise<StreamResult>
  onNavigate: (id: string) => void
}) {
  const [filter, setFilter] = useState("")
  const [limit, setLimit] = useState(50)
  const access = useMemo(
    () => resourcePageAccess(document, objectMap),
    [document, objectMap]
  )
  const resources = useMemo(
    () => document.objects.filter((object) => resourceKind(object)),
    [document]
  )
  const matching = resources.filter((object) =>
    `${object.id} ${object.label} ${detail(object, "BaseFont")} ${resourceKind(object)}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  )
  return (
    <section
      aria-label="Visual resource browser"
      className="resource-browser min-h-0 flex-1 overflow-auto p-5"
    >
      <h1 className="mb-2 text-xl font-medium">Resources</h1>
      <p className="mb-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Inspect fonts, images, and reusable forms. Page links show where a
        resource is available, including inherited and nested resources; they do
        not prove it is drawn on the page. Image previews run locally on demand.
      </p>
      <Input
        aria-label="Filter resources"
        placeholder="Filter by kind, object ID, or font name…"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value)
          setLimit(50)
        }}
      />
      <p className="my-3 text-xs text-muted-foreground">
        {matching.length} resource{matching.length === 1 ? "" : "s"}
        {access.incomplete
          ? " · Page-resource indexing incomplete (bounded traversal or unavailable references)."
          : ""}
      </p>
      <div className="divide-y">
        {matching.slice(0, limit).map((object) => {
          const kind = resourceKind(object)!
          const pages = access.pages.get(object.id) ?? []
          return (
            <article
              key={object.id}
              aria-label={`${kind} ${object.id}`}
              className="min-w-0 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium">{kind}</h2>
                <button
                  className="reference font-mono"
                  onClick={() => onNavigate(object.id)}
                >
                  {object.id} obj
                </button>
              </div>
              <p className="mt-1 text-xs break-words text-muted-foreground">
                {object.label}
              </p>
              {kind === "Font" ? (
                <dl className="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Base font</dt>
                  <dd className="font-mono break-all">
                    {detail(object, "BaseFont")}
                  </dd>
                  <dt className="text-muted-foreground">Subtype</dt>
                  <dd className="font-mono break-all">
                    {detail(object, "Subtype")}
                  </dd>
                  <dt className="text-muted-foreground">Encoding</dt>
                  <dd className="font-mono break-all">
                    {detail(object, "Encoding")}
                  </dd>
                </dl>
              ) : kind === "Image" ? (
                <>
                  <p className="mt-2 text-xs">
                    {detail(object, "Width")} × {detail(object, "Height")} ·{" "}
                    {detail(object, "ColorSpace")} ·{" "}
                    {detail(object, "BitsPerComponent")} bits/component
                  </p>
                  <ImageThumbnail
                    key={object.id}
                    object={object}
                    readStream={readStream}
                  />
                </>
              ) : (
                <p className="my-3 text-xs text-muted-foreground">
                  Reusable form XObject. Follow the object to inspect its
                  drawing instructions and resources; this is not an image
                  thumbnail.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Available to:</span>
                {pages.length ? (
                  <>
                    {pages.slice(0, 30).map((page) => (
                      <button
                        className="reference"
                        key={page}
                        onClick={() => onNavigate(document.pages[page - 1])}
                      >
                        Page {page}
                      </button>
                    ))}
                    {pages.length > 30 && (
                      <span className="text-muted-foreground">
                        and {pages.length - 30} more pages
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    No page found in the indexed resource paths.
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Open the object for its dictionary, provenance, and original
                bytes.
              </p>
            </article>
          )
        })}
      </div>
      {!matching.length && (
        <p className="py-6 text-sm text-muted-foreground">
          {resources.length
            ? "No resources match this filter."
            : "No font, image, or form resources were identified in the indexed objects."}
        </p>
      )}
      {matching.length > limit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLimit((count) => count + 50)}
        >
          Show 50 more resources
        </Button>
      )}
    </section>
  )
}
