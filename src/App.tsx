import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookmarkPlus,
  Pin,
  Binary,
  Braces,
  Check,
  ChevronRight,
  File as FileIcon,
  FileCode2,
  FilePlus2,
  Files,
  FolderOpen,
  Image,
  Layers,
  LayoutDashboard,
  ListTree,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { LimitationsDialog } from "@/components/limitations-dialog"
import { HexView } from "@/components/hex-view"
import {
  ObjectInspector,
  type InspectorTab,
} from "@/components/object-inspector"
import { ValueView } from "@/components/value-view"
import { InspectionUnavailable } from "@/components/inspection-unavailable"
import {
  SessionBookmarks,
  type SessionBookmark,
} from "@/components/session-bookmarks"
import { ObjectComparison } from "@/components/object-comparison"
import { ResourceBrowser } from "@/components/resource-browser"
import {
  extendExplorationTrail,
  referencePathOwners,
  type ExplorationStep,
} from "@/lib/pdf/exploration-trail"
import { PdfWorkerClient } from "@/lib/pdf/client"
import { effectiveResources, hasSubtype } from "@/lib/pdf/navigation"
import type {
  ByteRange,
  PdfDocumentInfo,
  PdfObjectRecord,
  PdfValue,
} from "@/lib/pdf/types"
import "./app.css"

const PdfPreview = lazy(() =>
  import("@/components/pdf-preview").then((module) => ({
    default: module.PdfPreview,
  }))
)
const EMPTY = new Uint8Array()
const SAMPLES = [
  {
    file: "minimal.pdf",
    name: "A simple page",
    detail: "Catalog, page tree, font, and drawing instructions",
    icon: FileCode2,
  },
  {
    file: "resources.pdf",
    name: "Fonts & resources",
    detail: "Explore page resources and their references",
    icon: Layers,
  },
  {
    file: "compressed.pdf",
    name: "Compressed objects",
    detail: "See how objects live inside decoded streams",
    icon: Braces,
  },
]
type Selection = {
  id: string | null
  tab: InspectorTab
  section: Section
  range?: ByteRange
  notice?: string
  trail?: ExplorationStep[]
}
type Section =
  "overview" | "catalog" | "pages" | "resources" | "objects" | "structure"
type SearchResult = {
  label: string
  detail: string
  id?: string
  range?: ByteRange
}
const size = (value: number) =>
  value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 900px)").matches
  )
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)")
    const update = () => setNarrow(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return narrow
}

export default function App() {
  const [limitationsOpen, setLimitationsOpen] = useState(false)
  const limitationsOpener = useRef<HTMLElement | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const client = useRef<PdfWorkerClient | null>(null)
  const requestId = useRef(0)
  const searchId = useRef(0)
  const [bytes, setBytes] = useState(EMPTY)
  const [filename, setFilename] = useState("")
  const [document, setDocument] = useState<PdfDocumentInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inspectionError, setInspectionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [history, setHistory] = useState<Selection[]>([
    { id: null, tab: "properties", section: "overview" },
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [bookmarks, setBookmarks] = useState<SessionBookmark<Selection>[]>([])
  const bookmarkKey = useRef(0)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState("objects")
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null
  )
  const [searching, setSearching] = useState(false)
  const [resultsScope, setResultsScope] = useState("objects")
  const [searchMessage, setSearchMessage] = useState("")
  const [mobilePane, setMobilePane] = useState("inspector")
  const [objectScroll, setObjectScroll] = useState(0)
  const narrow = useNarrow()
  const selection = history[historyIndex]
  const section = selection.section
  const objects = useMemo(() => document?.objects ?? [], [document])
  const objectMap = useMemo(
    () => new Map(objects.map((object) => [object.id, object])),
    [objects]
  )
  const selected = selection.id ? objectMap.get(selection.id) : undefined
  const selectedRange =
    selection.range ??
    (selected?.provenance.type === "file"
      ? selected.provenance.range
      : selected?.provenance.type === "decoded"
        ? selected.provenance.containerRange
        : undefined)

  function objectStep(id: string): ExplorationStep {
    const pageIndex = document?.pages.indexOf(id) ?? -1
    return { id, label: pageIndex >= 0 ? `Page ${pageIndex + 1}` : `${id} obj` }
  }
  function followReference(id: string, path?: string[]) {
    if (!objectMap.has(id)) {
      setNotice(
        `Reference ${id} R has no available object in the current object set.`
      )
      return
    }
    const source = selected
      ? objectStep(selected.id)
      : { id: null, label: section === "structure" ? "Trailer" : "Document" }
    const trail = extendExplorationTrail(
      selection.trail ?? [],
      source,
      objectStep(id),
      path,
      referencePathOwners(
        selected?.value ?? document!.trailer,
        path ?? [],
        objectMap,
        source.id
      )
    )
    visit({ id, tab: "properties", section, trail })
    setMobilePane("inspector")
  }
  function addBookmark() {
    if (!selection.id && !selection.range) return
    const rangeLabel = selection.range
      ? `Bytes 0x${selection.range.start.toString(16).toUpperCase()}–0x${(selection.range.end - 1).toString(16).toUpperCase()}`
      : ""
    const label = rangeLabel || `${selection.id} obj · ${selection.tab}`
    setBookmarks((current) =>
      current.concat({
        key: ++bookmarkKey.current,
        label,
        selection: { ...selection },
        note: "",
      })
    )
  }
  function visit(next: Selection) {
    if (next.section !== section) setObjectScroll(0)
    setNotice(next.notice ?? null)
    setPreview(false)
    const page = document?.pages.indexOf(next.id ?? "") ?? -1
    if (page >= 0) setPreviewPage(page + 1)
    if (
      selection.id === next.id &&
      selection.tab === next.tab &&
      selection.section === next.section &&
      selection.range?.start === next.range?.start &&
      selection.range?.end === next.range?.end &&
      JSON.stringify(selection.trail) === JSON.stringify(next.trail)
    )
      return
    setHistory(history.slice(0, historyIndex + 1).concat(next))
    setHistoryIndex(historyIndex + 1)
  }
  function navigate(
    id: string | null,
    tab: InspectorTab = "properties",
    nextSection: Section = section
  ) {
    if (id && !objectMap.has(id)) {
      setNotice(
        `Reference ${id} R has no available object in the current object set.`
      )
      return
    }
    visit({
      id,
      tab,
      section: nextSection,
      trail: id
        ? id === selected?.id
          ? (selection.trail ?? [objectStep(id)])
          : [objectStep(id)]
        : undefined,
    })
    setMobilePane("inspector")
  }
  function selectRange(range: ByteRange, message?: string) {
    visit({ ...selection, range, notice: message })
    setMobilePane("bytes")
  }
  function travel(direction: number) {
    const index = Math.max(
      0,
      Math.min(history.length - 1, historyIndex + direction)
    )
    const next = history[index]
    if (next.section !== section) setObjectScroll(0)
    setHistoryIndex(index)
    setNotice(next.notice ?? null)
    setPreview(false)
    setMobilePane(next.range ? "bytes" : "inspector")
    setSearchResults(null)
    const page = document?.pages.indexOf(next.id ?? "") ?? -1
    if (page >= 0) setPreviewPage(page + 1)
  }
  const close = useCallback(() => {
    requestId.current++
    searchId.current++
    client.current?.dispose()
    client.current = null
    setBytes(EMPTY)
    setFilename("")
    setDocument(null)
    setBusy(false)
    setError(null)
    setInspectionError(null)
    setNotice(null)
    setPreview(false)
    setSearchResults(null)
    setSearching(false)
    setQuery("")
    setHistory([{ id: null, tab: "properties", section: "overview" }])
    setHistoryIndex(0)
    setObjectScroll(0)
    setPreviewPage(1)
    setBookmarks([])
    setPinnedId(null)
  }, [])
  useEffect(
    () => () => {
      client.current?.dispose()
    },
    []
  )
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "o") {
        event.preventDefault()
        input.current?.click()
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  async function open(file: File) {
    close()
    const token = requestId.current
    if (file.size > 64 * 1024 * 1024) {
      setError(
        "This file exceeds the current 64 MiB limit. Choose a smaller PDF."
      )
      return
    }
    if (!file.size) {
      setError("This file is empty. Choose a PDF with content.")
      return
    }
    setBusy(true)
    setFilename(file.name)
    try {
      const original = new Uint8Array(await file.arrayBuffer())
      if (token !== requestId.current) return
      setBytes(original)
      const worker = new PdfWorkerClient()
      client.current = worker
      const parsed = await worker.open(original, file.name)
      if (token !== requestId.current) return
      setDocument(parsed)
      setBusy(false)
    } catch (reason) {
      if (token !== requestId.current) return
      const message =
        reason instanceof Error
          ? reason.message
          : "Could not inspect this file. Choose another PDF."
      setError(message)
      setInspectionError(message)
      setBusy(false)
    }
  }
  async function sample(file: string) {
    close()
    const token = requestId.current
    setBusy(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/${file}`)
      if (!response.ok)
        throw new Error(
          "The sample could not be loaded. Try opening a local PDF."
        )
      const data = await response.arrayBuffer()
      if (token !== requestId.current) return
      await open(new File([data], file, { type: "application/pdf" }))
    } catch (reason) {
      if (token === requestId.current) {
        setBusy(false)
        setError(
          reason instanceof Error ? reason.message : "Could not open sample."
        )
      }
    }
  }
  const readStream = useCallback((id: string, mode: "raw" | "decoded") => {
    if (!client.current)
      return Promise.reject(new Error("Open a PDF before reading a stream."))
    return client.current.readStream(id, mode)
  }, [])

  async function search() {
    const token = ++searchId.current
    const term = query.trim()
    if (!term) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setSearchResults([])
    setSearchMessage("")
    setResultsScope(scope)
    const found: SearchResult[] = []
    try {
      if (scope === "objects" || scope === "keys") {
        const needle = term.toLowerCase()
        const hasKey = (value: PdfValue): boolean => {
          if (value.type === "dictionary" || value.type === "stream")
            return value.entries.some(
              (entry) =>
                entry.key.toLowerCase().includes(needle.replace(/^\//, "")) ||
                hasKey(entry.value)
            )
          return value.type === "array" && value.items.some(hasKey)
        }
        for (const object of objects)
          if (
            scope === "keys"
              ? hasKey(object.value)
              : `${object.id} ${object.id} R ${object.label} ${object.kind}`
                  .toLowerCase()
                  .includes(needle)
          ) {
            found.push({
              label: `${object.id} obj`,
              detail: object.label,
              id: object.id,
            })
            if (found.length === 500) break
          }
      } else if (scope === "decoded") {
        let skipped = 0
        for (const object of objects.filter((object) => object.stream)) {
          if (token !== searchId.current) return
          try {
            const result = await readStream(object.id, "decoded")
            if (result.error || result.truncated) skipped++
            if (result.text.toLowerCase().includes(term.toLowerCase()))
              found.push({
                label: `${object.id} obj`,
                detail: "Match in decoded byte text (Latin-1)",
                id: object.id,
              })
          } catch {
            skipped++
          }
          if (found.length === 500) break
        }
        if (skipped)
          setSearchMessage(
            `${skipped} stream(s) unsupported or incomplete. Results are partial.`
          )
      } else {
        const compact = term.replace(/\s/g, "")
        if (
          scope === "hex" &&
          (!/^[\da-f]+$/i.test(compact) || compact.length % 2)
        )
          throw new Error("Enter complete hex bytes, for example 25 50 44 46.")
        if (
          scope === "text" &&
          [...term].some((character) => character.charCodeAt(0) > 255)
        )
          throw new Error(
            "Original byte-text search accepts Latin-1 characters (0–255). Use decoded search for stream content."
          )
        const needle =
          scope === "hex"
            ? Uint8Array.from(compact.match(/../g) ?? [], (pair) =>
                parseInt(pair, 16)
              )
            : Uint8Array.from(term, (character) => character.charCodeAt(0))
        for (let offset = 0; offset <= bytes.length - needle.length; offset++) {
          if (offset % 100000 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0))
            if (token !== searchId.current) return
          }
          if (bytes[offset] !== needle[0]) continue
          let matches = true
          for (let index = 1; index < needle.length; index++)
            if (bytes[offset + index] !== needle[index]) {
              matches = false
              break
            }
          if (matches) {
            found.push({
              label: `0x${offset.toString(16).toUpperCase()}`,
              detail: `${needle.length} original file bytes`,
              range: { start: offset, end: offset + needle.length },
            })
            if (found.length === 500) break
          }
        }
      }
      if (token === searchId.current) {
        setSearchResults(found)
        if (found.length === 500)
          setSearchMessage("Showing the first 500 matches. Narrow your search.")
        setSearching(false)
      }
    } catch (reason) {
      if (token === searchId.current) {
        setSearchMessage(
          reason instanceof Error ? reason.message : "Search failed."
        )
        setSearching(false)
      }
    }
  }
  function selectByte(offset: number) {
    const object = objects.find(
      (object) =>
        object.provenance.type === "file" &&
        offset >= object.provenance.range.start &&
        offset < object.provenance.range.end
    )
    if (object) navigate(object.id)
    else {
      selectRange(
        { start: offset, end: offset + 1 },
        `Byte 0x${offset.toString(16).toUpperCase()} has no known containing object.`
      )
    }
  }
  function chooseSection(next: Section) {
    setSearchResults(null)
    if (next === "overview" || next === "structure" || next === "resources")
      navigate(null, "properties", next)
    else if (next === "catalog" && document?.catalogId)
      navigate(document.catalogId, "properties", next)
    else visit({ ...selection, section: next })
  }
  const resourceObjects = objects.filter((object) =>
    ["Font", "Image", "XObject", "Form"].includes(object.kind)
  )
  const listedObjects =
    section === "pages"
      ? (document?.pages ?? [])
          .map((id) => objectMap.get(id))
          .filter((object): object is PdfObjectRecord => !!object)
      : section === "resources"
        ? resourceObjects
        : objects
  const listStart = Math.max(0, Math.floor(objectScroll / 42) - 5)
  const visibleObjects = listedObjects.slice(listStart, listStart + 45)

  const explorer = (
    <aside className="explorer" aria-label="Structure explorer">
      <div className="pane-heading">
        <ListTree size={15} />
        <span>Explorer</span>
        <Badge variant="outline">{objects.length}</Badge>
      </div>
      <nav className="explorer-nav" aria-label="Document sections">
        {(
          [
            ["overview", LayoutDashboard, "Overview"],
            ["catalog", FolderOpen, "Document catalog"],
            ["pages", Files, "Pages"],
            ["resources", Layers, "Resources"],
            ["objects", Braces, "All objects"],
            ["structure", FileCode2, "File structure"],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            className={`nav-item ${section === key ? "active" : ""}`}
            onClick={() => {
              chooseSection(key)
              setObjectScroll(0)
            }}
          >
            <Icon size={15} />
            <span>{label}</span>
            {key === "pages" && (
              <span className="nav-count">{document?.pages.length ?? "—"}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="object-list-heading">
        {section === "pages"
          ? "PAGE OBJECTS"
          : section === "resources"
            ? "RESOURCE OBJECTS"
            : "INDIRECT OBJECTS"}
        <span>{listedObjects.length}</span>
      </div>
      <div
        className="object-list"
        key={section}
        onScroll={(event) => setObjectScroll(event.currentTarget.scrollTop)}
      >
        <div
          style={{ height: listedObjects.length * 42, position: "relative" }}
        >
          {visibleObjects.map((object, index) => (
            <button
              key={object.id}
              className={`object-row ${selection.id === object.id ? "selected" : ""}`}
              style={{ position: "absolute", top: (listStart + index) * 42 }}
              onClick={() => navigate(object.id)}
            >
              <Braces size={14} />
              <span>
                <code>{object.id}</code>
                <span className="object-label">{object.kind}</span>
              </span>
              {object.provenance.type === "decoded" ? (
                <Layers size={12} aria-label="Inside object stream" />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
          ))}
        </div>
        {!listedObjects.length && (
          <p className="list-empty">
            {document?.locked
              ? "Object inspection is locked."
              : "No objects in this section."}
          </p>
        )}
      </div>
      <SessionBookmarks
        bookmarks={bookmarks}
        onVisit={(saved) => {
          visit(saved)
          setMobilePane(saved.range ? "bytes" : "inspector")
        }}
        onNote={(key, note) =>
          setBookmarks((current) =>
            current.map((bookmark) =>
              bookmark.key === key ? { ...bookmark, note } : bookmark
            )
          )
        }
        onRemove={(key) =>
          setBookmarks((current) =>
            current.filter((bookmark) => bookmark.key !== key)
          )
        }
      />
    </aside>
  )

  const overview = (
    <div className="overview inspector-scroll">
      <div className="overview-heading">
        <FileCode2 size={25} />
        <h1>
          {section === "structure" ? "File structure" : "Document overview"}
        </h1>
        <p>{filename}</p>
      </div>
      {document ? (
        <>
          <dl className="document-facts">
            <div>
              <dt>PDF version</dt>
              <dd>
                {document.version}
                {document.catalogVersion
                  ? ` (catalog ${document.catalogVersion})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{size(bytes.length)}</dd>
            </div>
            <div>
              <dt>Pages</dt>
              <dd>{document.locked ? "Locked" : document.pages.length}</dd>
            </div>
            <div>
              <dt>Indirect objects</dt>
              <dd>{document.locked ? "Locked" : objects.length}</dd>
            </div>
            <div>
              <dt>Cross-references</dt>
              <dd>{document.xrefFormat}</dd>
            </div>
            <div>
              <dt>Encryption</dt>
              <dd>{document.encrypted ? "Encrypted" : "None"}</dd>
            </div>
          </dl>
          {document.locked && (
            <div className="warning-inline">
              <LockKeyhole size={16} />
              <p>
                This PDF is encrypted. Structure inspection is locked because
                password entry is not supported yet. An encrypted PDF may have
                an opening password or permissions restrictions; this viewer
                does not distinguish between them. Try an unencrypted copy
                exported from the source application. Original bytes remain
                available.
              </p>
            </div>
          )}
          {section === "structure" ? (
            <>
              <h2>Cross-reference entry point</h2>
              {document.startXref !== undefined ? (
                <Button
                  variant="outline"
                  className="font-mono"
                  onClick={() => {
                    selectRange({
                      start: document.startXref!,
                      end: Math.min(bytes.length, document.startXref! + 32),
                    })
                  }}
                >
                  startxref → 0x{document.startXref.toString(16).toUpperCase()}
                  <ArrowUpRight size={14} />
                </Button>
              ) : (
                <p className="muted">
                  No reliable startxref location available.
                </p>
              )}
              <h2>Trailer dictionary</h2>
              <ValueView
                value={document.trailer}
                onNavigate={followReference}
              />
            </>
          ) : (
            <>
              <h2>Start exploring</h2>
              <div className="overview-actions">
                <Button
                  variant="outline"
                  disabled={!document.catalogId}
                  onClick={() =>
                    document.catalogId && navigate(document.catalogId)
                  }
                >
                  <FolderOpen size={15} />
                  Document catalog
                  <ArrowUpRight size={13} />
                </Button>
                <Button
                  variant="outline"
                  disabled={!document.pages.length}
                  onClick={() => {
                    navigate(document.pages[0], "properties", "pages")
                  }}
                >
                  <Files size={15} />
                  First page
                  <ArrowUpRight size={13} />
                </Button>
                <Button
                  variant="outline"
                  disabled={document.locked}
                  onClick={() => setPreview(true)}
                >
                  <Image size={15} />
                  Page preview
                </Button>
              </div>
              <p className="overview-tip">
                Follow a reference such as <code>4 0 R</code> to inspect another
                object. Its source bytes highlight in the hex view.
              </p>
              <h2>Resources</h2>
              <p className="muted">
                {
                  resourceObjects.filter((object) => object.kind === "Font")
                    .length
                }{" "}
                font objects ·{" "}
                {
                  resourceObjects.filter((object) =>
                    hasSubtype(object, "Image")
                  ).length
                }{" "}
                image objects ·{" "}
                {objects.filter((object) => object.stream).length} streams
              </p>
              <p className="representation-note">
                Counts describe the indexed object set, including unreferenced
                objects. They are not a content inventory.
              </p>
            </>
          )}
          {document.warnings.length > 0 && (
            <section className="warnings">
              <h2>
                Parsing notes{" "}
                <Badge variant="outline">{document.warnings.length}</Badge>
              </h2>
              {document.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </section>
          )}
        </>
      ) : (
        <InspectionUnavailable
          reason={inspectionError ?? undefined}
          onOpenFile={() => input.current?.click()}
          onShowBytes={() => {
            selectRange({ start: 0, end: Math.min(bytes.length, 1) })
            setMobilePane("bytes")
          }}
        />
      )}
    </div>
  )

  const inspector = (
    <main
      className="main-inspector"
      aria-label="Document inspection"
      aria-busy={busy}
    >
      <div className="pane-heading">
        <span>
          {busy
            ? "Opening PDF"
            : preview
              ? "Page preview"
              : selected
                ? "Object inspector"
                : section === "structure"
                  ? "File structure"
                  : section === "resources"
                    ? "Resource browser"
                    : "Overview"}
        </span>
        <div className="pane-actions">
          {section === "resources" && selected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(null, "properties", "resources")}
            >
              Browse resources
            </Button>
          )}
          {(selected || selection.range) && (
            <Button variant="ghost" size="sm" onClick={addBookmark}>
              <BookmarkPlus size={14} />
              Bookmark
            </Button>
          )}
          {selected && (
            <Button
              variant={pinnedId === selected.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() =>
                setPinnedId(pinnedId === selected.id ? null : selected.id)
              }
              aria-pressed={pinnedId === selected.id}
            >
              <Pin size={14} />
              {pinnedId === selected.id ? "Unpin" : "Pin to compare"}
            </Button>
          )}
          <Button
            variant={preview ? "secondary" : "ghost"}
            size="sm"
            disabled={!bytes.length || busy}
            onClick={() => setPreview(!preview)}
          >
            {preview ? <Braces size={14} /> : <Image size={14} />}
            {preview ? "Inspect" : "Preview"}
          </Button>
        </div>
      </div>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {busy ? (
        <section
          className="document-loading"
          role="status"
          aria-label="Opening PDF"
        >
          <LoaderCircle
            size={32}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <h1>Opening PDF…</h1>
          <p>
            Reading objects and building the document structure. Larger
            documents can take a few seconds.
          </p>
        </section>
      ) : preview && bytes.length ? (
        <Suspense
          fallback={<p className="loading-inline">Loading EmbedPDF…</p>}
        >
          <PdfPreview
            bytes={bytes}
            fileName={filename}
            pageNumber={previewPage}
            onPageChange={setPreviewPage}
          />
        </Suspense>
      ) : selected ? (
        <div className="inspection-detail-stack min-h-0 flex-1 overflow-auto">
          {pinnedId && objectMap.has(pinnedId) && (
            <ObjectComparison
              pinned={objectMap.get(pinnedId)!}
              current={selected}
              onUnpin={() => setPinnedId(null)}
              onNavigate={(id) => navigate(id)}
            />
          )}
          <ObjectInspector
            object={selected}
            tab={selection.tab}
            resources={
              selected.kind === "Page"
                ? effectiveResources(selected, objectMap)
                : undefined
            }
            onTabChange={(tab) => navigate(selected.id, tab)}
            onNavigate={followReference}
            objects={objectMap}
            pages={document?.pages}
            contextPageId={
              [...(selection.trail ?? [])]
                .reverse()
                .find(
                  (step) =>
                    step.id !== null && document?.pages.includes(step.id)
                )?.id ?? undefined
            }
            readStream={readStream}
          />
        </div>
      ) : section === "resources" && document ? (
        <ResourceBrowser
          document={document}
          objectMap={objectMap}
          readStream={readStream}
          onNavigate={(id) => navigate(id)}
        />
      ) : (
        overview
      )}
    </main>
  )

  return (
    <TooltipProvider delay={250}>
      <div
        className="app-shell"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault()
            setDragging(true)
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file) void open(file)
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          aria-label="Open local PDF"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void open(file)
            event.target.value = ""
          }}
        />
        <header className="app-header">
          <a
            className="app-identity"
            href="#"
            onClick={(event) => {
              event.preventDefault()
              if (document) {
                navigate(null, "properties", "overview")
              }
            }}
          >
            <span className="app-mark">
              <Binary size={19} />
            </span>
            <span>PDF Internals</span>
          </a>
          <span className="header-divider" />
          <div className="filename">
            {filename ? (
              <>
                <FileIcon size={14} />
                <span title={filename}>{filename}</span>
                <span className="file-size">{size(bytes.length)}</span>
              </>
            ) : (
              <span className="muted">Local workspace</span>
            )}
          </div>
          <div className="header-actions">
            {filename && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={busy ? "Cancel opening PDF" : "Close document"}
                title={busy ? "Cancel opening PDF" : "Close document"}
                onClick={close}
              >
                <X size={15} />
              </Button>
            )}
            <Button onClick={() => input.current?.click()} size="sm">
              <FolderOpen size={15} />
              Open PDF
            </Button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss error"
              onClick={() => setError(null)}
            >
              <X size={14} />
            </Button>
          </div>
        )}
        {bytes.length || busy ? (
          <>
            <div className="workspace-toolbar">
              <div className="history-controls">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Back"
                  disabled={historyIndex === 0}
                  onClick={() => travel(-1)}
                >
                  <ArrowLeft size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Forward"
                  disabled={historyIndex >= history.length - 1}
                  onClick={() => travel(1)}
                >
                  <ArrowRight size={15} />
                </Button>
                <nav
                  className="exploration-trail flex min-w-0 items-center gap-1 overflow-x-auto text-xs"
                  aria-label="Exploration trail"
                >
                  {busy
                    ? "Inspecting…"
                    : selection.trail?.length
                      ? selection.trail.map((step, index) => (
                          <span
                            className="flex shrink-0 items-center gap-1"
                            key={`${index}-${step.id}`}
                          >
                            {index > 0 && (
                              <ChevronRight size={12} aria-hidden="true" />
                            )}
                            {index === selection.trail!.length - 1 ? (
                              <span
                                aria-current="location"
                                className="font-mono"
                              >
                                {step.label}
                              </span>
                            ) : (
                              <button
                                className="reference whitespace-nowrap"
                                onClick={() => {
                                  visit({
                                    id: step.id,
                                    tab: "properties",
                                    section,
                                    trail: selection.trail!.slice(0, index + 1),
                                  })
                                  setMobilePane("inspector")
                                }}
                              >
                                {step.label}
                              </button>
                            )}
                          </span>
                        ))
                      : section === "resources"
                        ? "Resources"
                        : section === "structure"
                          ? "File structure"
                          : "Document overview"}
                </nav>
              </div>
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void search()
                }}
              >
                <Search size={14} />
                <Input
                  ref={searchInput}
                  aria-label="Search document"
                  placeholder="Search document…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  aria-label="Search scope"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="objects">Objects</option>
                  <option value="keys">Keys</option>
                  <option value="text">File text</option>
                  <option value="hex">File hex</option>
                  <option value="decoded">Decoded streams</option>
                </select>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  type="submit"
                  aria-label="Run search"
                  disabled={searching || busy}
                >
                  <ArrowRight size={14} />
                </Button>
                {searchResults !== null && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Close search"
                    type="button"
                    onClick={() => {
                      searchId.current++
                      setSearching(false)
                      setSearchResults(null)
                    }}
                  >
                    <X size={14} />
                  </Button>
                )}
              </form>
            </div>
            {searchResults !== null && (
              <section className="search-results" aria-label="Search results">
                <div className="search-results-header">
                  <span>
                    {searching
                      ? "Searching…"
                      : `${searchResults.length} match${searchResults.length === 1 ? "" : "es"}`}
                    {` · ${resultsScope === "text" ? "Latin-1 file bytes" : resultsScope === "decoded" ? "decoded streams" : resultsScope}`}
                  </span>
                  {searching && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        searchId.current++
                        setSearching(false)
                        setSearchMessage(
                          "Search cancelled. Results may be incomplete."
                        )
                      }}
                    >
                      {resultsScope === "decoded"
                        ? "Stop after current stream"
                        : "Cancel search"}
                    </Button>
                  )}
                </div>
                {searchMessage && <p role="status">{searchMessage}</p>}
                <div className="search-matches">
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (result.id)
                          navigate(
                            result.id,
                            resultsScope === "decoded"
                              ? "decoded"
                              : "properties"
                          )
                        else if (result.range) {
                          selectRange(result.range)
                        }
                      }}
                    >
                      <code>{result.label}</code>
                      <span>{result.detail}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {busy && (
              <div className="progress-line">
                Opening PDF…{" "}
                <Button variant="ghost" size="xs" onClick={close}>
                  Cancel
                </Button>
              </div>
            )}
            {narrow ? (
              <>
                <nav className="mobile-pane-nav" aria-label="Workspace pane">
                  {["explorer", "inspector", "bytes"].map((pane) => (
                    <Button
                      key={pane}
                      variant={pane === mobilePane ? "secondary" : "ghost"}
                      onClick={() => setMobilePane(pane)}
                    >
                      {pane === "bytes"
                        ? "Original bytes"
                        : pane[0].toUpperCase() + pane.slice(1)}
                    </Button>
                  ))}
                </nav>
                <div className="mobile-workspace">
                  {mobilePane === "explorer" ? (
                    explorer
                  ) : mobilePane === "bytes" ? (
                    <HexView
                      bytes={bytes}
                      range={selectedRange}
                      onByteSelect={selectByte}
                    />
                  ) : (
                    inspector
                  )}
                </div>
              </>
            ) : (
              <div className="desktop-workspace">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel
                    defaultSize="20%"
                    minSize="180px"
                    maxSize="35%"
                  >
                    {explorer}
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize="43%" minSize="300px">
                    {inspector}
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize="37%" minSize="290px">
                    <HexView
                      bytes={bytes}
                      range={selectedRange}
                      onByteSelect={selectByte}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}
          </>
        ) : (
          <main className="empty-workspace">
            <div className="empty-introduction">
              <span className="empty-file">
                <FileCode2 size={30} strokeWidth={1.25} />
              </span>
              <h1>Look inside a PDF.</h1>
              <p>
                Explore objects, follow references, and connect
                <br className="desktop-break" /> the structure to the original
                bytes.
              </p>
              <Button size="lg" onClick={() => input.current?.click()}>
                <FilePlus2 size={16} />
                Open a PDF<span className="shortcut">⌘ O</span>
              </Button>
              <span className="drop-hint">
                or drop a file anywhere · up to 64 MiB
              </span>
              <button
                className="empty-limitations-link"
                aria-haspopup="dialog"
                aria-controls="limitations-dialog"
                onClick={(event) => {
                  limitationsOpener.current = event.currentTarget
                  setLimitationsOpen(true)
                }}
              >
                Early version · View limitations
              </button>
            </div>
            <section className="samples">
              <h2>Or explore a sample</h2>
              {SAMPLES.map(({ file, name, detail, icon: Icon }) => (
                <button
                  className="sample-row"
                  key={file}
                  onClick={() => void sample(file)}
                >
                  <span className="sample-icon">
                    <Icon size={19} strokeWidth={1.5} />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <span>{detail}</span>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </section>
          </main>
        )}
        <footer className="status-bar">
          <span>
            <ShieldCheck size={13} />
            Files stay on your device
            <span className="status-divider" aria-hidden="true" />
            <button
              className="status-limitations-link"
              aria-haspopup="dialog"
              aria-controls="limitations-dialog"
              onClick={(event) => {
                limitationsOpener.current = event.currentTarget
                setLimitationsOpen(true)
              }}
            >
              About & limitations
            </button>
          </span>
          <span>
            {busy ? (
              "Inspecting"
            ) : document ? (
              <>
                <Check size={12} />
                {document.locked
                  ? "Locked document"
                  : document.recovered
                    ? "Recovered structure"
                    : `${objects.length} objects indexed`}
              </>
            ) : (
              "Read-only PDF exploration"
            )}
            <span className="status-divider" />
            {bytes.length
              ? `${bytes.length.toLocaleString()} bytes`
              : "No file open"}
          </span>
        </footer>
        <LimitationsDialog
          returnFocusRef={limitationsOpener}
          open={limitationsOpen}
          onOpenChange={setLimitationsOpen}
        />
        {dragging && (
          <div className="drop-overlay">
            <FolderOpen size={36} />
            <p>Drop your PDF to explore</p>
            <span>Processed locally in your browser</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
