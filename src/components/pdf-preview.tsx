import { localEngine } from '@embedpdf/engine'
import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'

type PreviewDocument = Awaited<ReturnType<ReturnType<typeof localEngine>['open']>>
type PreviewPages = Awaited<ReturnType<PreviewDocument['pages']['list']>>['pages']
type OpenedPreview = {
  bytes: Uint8Array
  document: PreviewDocument | null
  pages: PreviewPages
  error: string | null
}
type RenderedPreview = {
  request: object
  url: string | null
  error: string | null
}
const EMPTY_PAGES: PreviewPages = []

export interface PdfPreviewProps {
  bytes: Uint8Array
  fileName: string
  /** One-based page number, independently controlled from object selection. */
  pageNumber?: number
  onPageChange?: (pageNumber: number) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The PDF rendering engine could not open this document.'
}

/** Read-only local rendering. Never save/rewrite these bytes for the inspector. */
export function PdfPreview({ bytes, fileName, pageNumber, onPageChange }: PdfPreviewProps) {
  const [openedPreview, setOpenedPreview] = useState<OpenedPreview | null>(null)
  const [renderedPreview, setRenderedPreview] = useState<RenderedPreview | null>(null)
  const [localPage, setLocalPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const opened = openedPreview?.bytes === bytes ? openedPreview : null
  const document = opened?.document ?? null
  const pages = opened?.pages ?? EMPTY_PAGES
  const currentPage = Math.max(1, Math.min(pageNumber ?? localPage, Math.max(1, pages.length)))
  const renderIdentity = useMemo(() => ({ document, page: currentPage, zoom }), [document, currentPage, zoom])
  const rendered = renderedPreview?.request === renderIdentity ? renderedPreview : null
  const opening = opened === null
  const rendering = document !== null && pages.length > 0 && rendered === null
  const error = opened?.error ?? rendered?.error ?? null
  const imageUrl = rendered?.url ?? null

  useEffect(() => {
    // Creating here is safe under Strict Mode's setup/cleanup/setup cycle.
    const engine = localEngine()
    let active = true
    let openedDocument: PreviewDocument | null = null

    // Always copy: an engine may transfer its input to its worker. The hex
    // inspector must retain its own original, non-detached byte buffer.
    const request = engine.open({ kind: 'bytes', bytes: bytes.slice().buffer })
    void request
      .then(async (opened) => {
        openedDocument = opened
        if (!active) return
        const listed = await opened.pages.list()
        if (!active) return
        setLocalPage(1)
        setZoom(1)
        setOpenedPreview({
          bytes,
          document: opened,
          pages: listed.pages,
          error: listed.pages.length === 0 ? 'This PDF has no renderable pages.' : null,
        })
      })
      .catch((reason: unknown) => {
        if (active) setOpenedPreview({ bytes, document: null, pages: EMPTY_PAGES, error: errorMessage(reason) })
      })

    return () => {
      active = false
      request.abort()
      // Explicit close releases document resources; destroy also terminates the
      // dedicated worker, including a renderer stuck on a malformed document.
      if (openedDocument) void openedDocument.close().catch(() => undefined)
      void engine.destroy().catch(() => undefined)
    }
  }, [bytes])

  useEffect(() => {
    if (!document || !pages[currentPage - 1]) return
    let active = true
    let image: { url: string; revoke(): void } | null = null
    let imageRequest: { abort(): void } | null = null
    const page = document.page(pages[currentPage - 1].ref)
    const request = page.render.image({
      viewport: { kind: 'width', width: Math.min(2400, Math.round(1000 * zoom)) },
    })
    void request
      .then(async (rendered) => {
        if (!active) return
        const pending = rendered.objectUrl()
        imageRequest = pending
        const nextImage = await pending
        if (!active) {
          nextImage.revoke()
          return
        }
        image = nextImage
        setRenderedPreview({ request: renderIdentity, url: nextImage.url, error: null })
      })
      .catch((reason: unknown) => {
        if (active) setRenderedPreview({ request: renderIdentity, url: null, error: errorMessage(reason) })
      })

    return () => {
      active = false
      request.abort()
      imageRequest?.abort()
      image?.revoke()
    }
  }, [document, pages, currentPage, zoom, renderIdentity])

  function navigate(nextPage: number) {
    const next = Math.max(1, Math.min(nextPage, pages.length))
    setLocalPage(next)
    onPageChange?.(next)
  }

  return (
    <section aria-label="Rendered page preview" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <Button aria-label="Previous preview page" variant="ghost" size="icon-sm" disabled={opening || currentPage <= 1} onClick={() => navigate(currentPage - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-20 text-center text-xs tabular-nums" aria-live="polite">
            {pages.length ? `${currentPage} / ${pages.length}` : 'No page'}
          </span>
          <Button aria-label="Next preview page" variant="ghost" size="icon-sm" disabled={opening || currentPage >= pages.length} onClick={() => navigate(currentPage + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button aria-label="Zoom out preview" variant="ghost" size="icon-sm" disabled={opening || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>
            <ZoomOut className="size-4" />
          </Button>
          <span className="min-w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button aria-label="Zoom in preview" variant="ghost" size="icon-sm" disabled={opening || zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))}>
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-5" aria-busy={opening || rendering}>
        {error ? (
          <div role="alert" className="mx-auto flex max-w-sm flex-col items-center gap-3 py-12 text-center">
            <FileWarning className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Page preview unavailable</p>
            <p className="break-words text-xs leading-relaxed text-muted-foreground">{error}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">You can continue exploring the objects and original bytes.</p>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`${fileName}, page ${currentPage}`}
            draggable={false}
            className="mx-auto block h-auto max-w-none bg-white shadow-sm"
            style={{ width: `${zoom * 100}%` }}
          />
        ) : (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {opening ? 'Opening local preview…' : 'Rendering page…'}
          </div>
        )}
      </div>

      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Rendered locally with EmbedPDF · preview positions are not file offsets</p>
    </section>
  )
}
