import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookmarkPlus,
  BookOpen,
  Pin,
  Braces,
  Check,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  File as FileIcon,
  FileCode2,
  FileWarning,
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
  Shield,
  X,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { HexView } from "@/components/hex-view"
import {
  ObjectInspector,
  type InspectorTab,
} from "@/components/object-inspector"
import { ValueView } from "@/components/value-view"
import { IssuesPanel, IssueSummary } from "@/components/issues-panel"
import {
  diagnosticIssue,
  documentIssues,
  type PdfIssue,
} from "@/lib/pdf/issues"
import { InspectionUnavailable } from "@/components/inspection-unavailable"
import {
  SessionBookmarks,
  type SessionBookmark,
} from "@/components/session-bookmarks"
import {
  documentBookmarkKey,
  readBookmarks,
  writeBookmarks,
  type BookmarkSelection,
} from "@/lib/pdf/bookmark-storage"
import { ObjectComparison } from "@/components/object-comparison"
import { PageTree, type PageTreeState } from "@/components/page-tree"
import { ResourceBrowser } from "@/components/resource-browser"
import {
  resourceCatalog,
  type ResourceCategory,
  type ResourceEntry,
} from "@/lib/pdf/resource-catalog"
import {
  extendExplorationTrail,
  referencePathOwners,
  type ExplorationStep,
} from "@/lib/pdf/exploration-trail"
import { embeddedDownloads } from "@/lib/pdf/downloads"
import { PdfWorkerClient } from "@/lib/pdf/client"
import { effectiveResources, hasSubtype } from "@/lib/pdf/navigation"
import { pageRotationSummary } from "@/lib/pdf/page-rotation"
import type {
  ByteRange,
  PdfDocumentInfo,
  PdfObjectRecord,
  PdfValue,
} from "@/lib/pdf/types"
import { ContentHeaderLinks } from "@/components/content-navigation"
import { AboutPage } from "@/components/about-page"
import { BrandArtwork, BrandIcon } from "@/components/brand-artwork"
import { ThemeControl } from "@/components/theme-control"
import { SiteLinks } from "@/components/site-links"
import { MAX_INPUT_BYTES } from "@/lib/pdf/limits"
import { PublicPage } from "@/content/public-page"
import {
  SAMPLES as SITE_SAMPLES,
  ALL_SAMPLES,
  sitePage,
  type SitePath,
} from "@/lib/site-content"
import { useSiteRoute } from "@/lib/site-route"
import {
  useScrollRestoration,
  type ScrollPosition,
} from "@/lib/scroll-restoration"
import "./app.css"

const PdfPreview = lazy(() =>
  import("@/components/pdf-preview").then((module) => ({
    default: module.PdfPreview,
  }))
)
const emptyPageTree = (): PageTreeState => ({ expanded: new Set(), limits: {} })
const EMPTY = new Uint8Array()
const sampleIcons = {
  minimal: FileCode2,
  resources: Layers,
  compressed: Braces,
}
const SAMPLES = SITE_SAMPLES.map((sample) => ({
  ...sample,
  icon: sampleIcons[sample.id],
}))

type Selection = BookmarkSelection
const newViewports = () => ({
  inspector: {} as ScrollPosition,
  bytes: {} as ScrollPosition,
  resourceLimit: 50,
  issueLimit: 50,
})
type Section =
  | "overview"
  | "catalog"
  | "pages"
  | "resources"
  | "objects"
  | "structure"
  | "issues"
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
  // Match the build-time render; adapt after hydration on narrow screens.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)")
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return narrow
}

export default function App({ initialPath = "/" }: { initialPath?: SitePath }) {
  const [session, setSession] = useState({ id: 0, path: initialPath })
  return (
    <PdfWorkspace
      key={session.id}
      initialPath={session.path}
      openInitialSample={session.id === 0}
      onSessionEnd={() =>
        setSession((current) => ({
          id: current.id + 1,
          path: sitePage(window.location.pathname)?.path ?? "/",
        }))
      }
    />
  )
}

function PdfWorkspace({
  initialPath,
  openInitialSample: shouldOpenInitialSample,
  onSessionEnd,
}: {
  initialPath: SitePath
  openInitialSample: boolean
  onSessionEnd: () => void
}) {
  const { path, about, goHome, followLink } = useSiteRoute(initialPath)
  const input = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const client = useRef<PdfWorkerClient | null>(null)
  const requestId = useRef(0)
  const searchId = useRef(0)
  const [bytes, setBytes] = useState(EMPTY)
  const [filename, setFilename] = useState("")
  const [document, setDocument] = useState<PdfDocumentInfo | null>(null)
  const [observedIssues, setObservedIssues] = useState<PdfIssue[]>([])
  const issues = useMemo(
    () => [...(document ? documentIssues(document) : []), ...observedIssues],
    [document, observedIssues]
  )
  const issueSeverity = issues.some((issue) => issue.severity === "error")
    ? "error"
    : issues.some((issue) => issue.severity === "warning")
      ? "warning"
      : undefined
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inspectionError, setInspectionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [history, setHistory] = useState<Selection[]>([
    { id: null, tab: "properties", section: "overview" },
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [viewportHistory, setViewportHistory] = useState(() => [newViewports()])
  const viewports = viewportHistory[historyIndex]
  const overviewScroll = useScrollRestoration(viewports.inspector)
  const [bookmarks, setBookmarks] = useState<SessionBookmark<Selection>[]>([])
  const activeBookmarkStorageKey = useRef<string | null>(null)
  const [bookmarkStorageKey, setBookmarkStorageKey] = useState<string | null>(
    null
  )
  const [bookmarksSaved, setBookmarksSaved] = useState(true)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [previewPassword, setPreviewPassword] = useState<string | undefined>()
  const [preview, setPreview] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState("objects")
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null
  )
  const [activeSearchResult, setActiveSearchResult] = useState<number | null>(
    null
  )
  const activeSearchMatch = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeSearchMatch.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    })
  }, [activeSearchResult, searchResults])
  const [searching, setSearching] = useState(false)
  const [resultsScope, setResultsScope] = useState("objects")
  const [searchMessage, setSearchMessage] = useState("")
  const [mobilePane, setMobilePane] = useState("inspector")
  const [pageTreeState, setPageTreeState] = useState(emptyPageTree)
  const [objectScroll, setObjectScroll] = useState(0)
  const [resourceCategory, setResourceCategory] =
    useState<ResourceCategory>("All")
  const [resourceFilter, setResourceFilter] = useState("")
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
  function updateBookmarks(
    mutate: (
      current: SessionBookmark<Selection>[]
    ) => SessionBookmark<Selection>[]
  ) {
    const key = bookmarkStorageKey
    const apply = () => {
      if (activeBookmarkStorageKey.current !== key) return
      let current = bookmarks
      if (key && bookmarksSaved) {
        try {
          current = readBookmarks(key)
        } catch {
          /* Retain this tab's bookmarks if storage is blocked. */
        }
      }
      const next = mutate(current)
      setBookmarks(next)
      setBookmarksSaved(key ? writeBookmarks(key, next) : false)
    }
    // Serialize edits across tabs, reading the latest snapshot inside the lock.
    if (key && navigator.locks) void navigator.locks.request(key, apply)
    else apply()
  }
  useEffect(() => {
    if (!bookmarkStorageKey) return
    const sync = (event: StorageEvent) => {
      if (event.key !== bookmarkStorageKey && event.key !== null) return
      try {
        setBookmarks(readBookmarks(bookmarkStorageKey))
        setBookmarksSaved(true)
      } catch {
        setBookmarksSaved(false)
      }
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [bookmarkStorageKey])
  function addBookmark() {
    if (!selection.id && !selection.range) return
    const rangeLabel = selection.range
      ? `Bytes 0x${selection.range.start.toString(16).toUpperCase()}–0x${(selection.range.end - 1).toString(16).toUpperCase()}`
      : ""
    const label = rangeLabel || `${selection.id} obj · ${selection.tab}`
    updateBookmarks((current) =>
      current.concat({
        key: current.reduce((max, item) => Math.max(max, item.key), 0) + 1,
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
    setViewportHistory(
      viewportHistory.slice(0, historyIndex + 1).concat(newViewports())
    )
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
    setUnlocking(false)
    setUnlockError(null)
    setPreviewPassword(undefined)
    setDocument(null)
    setObservedIssues([])
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
    setViewportHistory([newViewports()])
    setObjectScroll(0)
    setPreviewPage(1)
    setPageTreeState(emptyPageTree())
    activeBookmarkStorageKey.current = null
    setBookmarkStorageKey(null)
    setBookmarksSaved(true)
    setBookmarks([])
    setPinnedId(null)
    setResourceCategory("All")
    setResourceFilter("")
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

  function endSession() {
    close()
    // Unmount the document owner so React's previous render, memoised graphs
    // and event-handler closures cannot retain a closed PDF until another update.
    onSessionEnd()
  }

  async function open(file: File) {
    goHome()
    close()
    const token = requestId.current
    if (file.size > MAX_INPUT_BYTES) {
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
      try {
        const key = await documentBookmarkKey(original)
        if (token !== requestId.current) return
        const saved = readBookmarks(key)
        activeBookmarkStorageKey.current = key
        setBookmarks(saved)
        setBookmarkStorageKey(key)
      } catch {
        if (token !== requestId.current) return
        setBookmarksSaved(false)
      }
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
  async function unlock(password: string) {
    if (unlocking) return
    const token = ++requestId.current
    setUnlocking(true)
    setUnlockError(null)
    client.current?.dispose()
    const worker = new PdfWorkerClient()
    client.current = worker
    try {
      const parsed = await worker.open(bytes, filename, password)
      if (token !== requestId.current) return
      setDocument(parsed)
      if (parsed.locked)
        setUnlockError(
          parsed.encryptionError ??
            "That password did not unlock this PDF. Try again."
        )
      else {
        setPreviewPassword(password)
        setNotice("PDF unlocked. Structure inspection is available.")
      }
    } catch (reason) {
      if (token !== requestId.current) return
      setUnlockError(
        reason instanceof Error ? reason.message : "Could not unlock this PDF."
      )
    } finally {
      if (token === requestId.current) setUnlocking(false)
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
  const openInitialSample = useEffectEvent((file: string) => {
    void sample(file)
  })
  useEffect(() => {
    if (!shouldOpenInitialSample) return
    const id = new URLSearchParams(window.location.search).get("sample")
    const selectedSample = ALL_SAMPLES.find((item) => item.id === id)
    if (!selectedSample) return
    const timer = window.setTimeout(
      () => openInitialSample(selectedSample.file),
      0
    )
    return () => window.clearTimeout(timer)
  }, [shouldOpenInitialSample])
  const readStream = useCallback(
    async (id: string, mode: "raw" | "decoded") => {
      if (!client.current)
        return Promise.reject(new Error("Open a PDF before reading a stream."))
      const activeClient = client.current
      const result = await activeClient.readStream(id, mode)
      if (result.error && activeClient === client.current) {
        const issue = diagnosticIssue(result.error, id)
        if (issue.severity === "warning") {
          issue.title = "Stream could not be read"
          issue.explanation =
            "The viewer could not read this stream. Inspect its dictionary and original bytes; a decoding failure alone does not establish a PDF defect."
        }
        setObservedIssues((current) =>
          current.some((item) => item.id === issue.id)
            ? current
            : [...current, issue]
        )
      }
      return result
    },
    []
  )
  const extractStream = useCallback(
    (id: string, purpose: "download" | "size" = "download") => {
      if (!client.current)
        return Promise.reject(
          new Error("Open a PDF before downloading a file.")
        )
      return client.current.readStream(id, "decoded", purpose)
    },
    []
  )
  const extractImage = useCallback((id: string) => {
    if (!client.current)
      return Promise.reject(
        new Error("Open a PDF before downloading an image.")
      )
    return client.current.readStream(id, "decoded", "image")
  }, [])

  function selectSearchResult(
    result: SearchResult,
    index: number,
    resultScope = resultsScope
  ) {
    setActiveSearchResult(index)
    if (result.id)
      navigate(result.id, resultScope === "decoded" ? "decoded" : "properties")
    else if (result.range) selectRange(result.range)
  }
  const selectLatestSearchResult = useRef(selectSearchResult)
  useLayoutEffect(() => {
    selectLatestSearchResult.current = selectSearchResult
  })
  function moveSearchResult(direction: number) {
    if (!searchResults?.length) return
    const index =
      ((activeSearchResult ?? (direction > 0 ? -1 : 0)) +
        direction +
        searchResults.length) %
      searchResults.length
    selectSearchResult(searchResults[index], index)
  }
  async function search() {
    const token = ++searchId.current
    const term = query.trim()
    if (!term) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setActiveSearchResult(null)
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
        if (found.length) selectLatestSearchResult.current(found[0], 0, scope)
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
    if (
      next === "overview" ||
      next === "structure" ||
      next === "resources" ||
      next === "issues"
    )
      navigate(null, "properties", next)
    else if (next === "catalog" && document?.catalogId)
      navigate(document.catalogId, "properties", next)
    else visit({ ...selection, section: next })
  }
  const downloadIndex = useMemo(
    () =>
      document?.indexes
        ? new Map(document.indexes.downloads)
        : embeddedDownloads(objectMap),
    [document, objectMap]
  )
  const resourceEntries = useMemo<ResourceEntry[]>(
    () =>
      document?.indexes
        ? document.indexes.resources.flatMap(({ objectId, ...entry }) => {
            const object = objectMap.get(objectId)
            return object ? [{ ...entry, object }] : []
          })
        : resourceCatalog(objectMap, downloadIndex),
    [document, objectMap, downloadIndex]
  )
  const resourceObjects = resourceEntries.map((entry) => entry.object)
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
            ["catalog", FolderOpen, "Document catalogue"],
            ["pages", Files, "Pages"],
            ["resources", Layers, "Resources"],
            ["objects", Braces, "All objects"],
            ["structure", FileCode2, "File structure"],
            ["issues", FileWarning, "Issues"],
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
            <Icon
              size={15}
              className={key === "issues" ? "issues-nav-icon" : undefined}
              data-severity={key === "issues" ? issueSeverity : undefined}
            />
            <span>{label}</span>
            {key === "issues" && (
              <span
                className="nav-count issues-nav-count"
                data-severity={issueSeverity}
              >
                {issues.filter((issue) => issue.severity !== "info").length}
              </span>
            )}
            {key === "pages" && (
              <span className="nav-count">{document?.pages.length ?? "—"}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="object-list-heading">
        {section === "pages"
          ? "PAGE CONNECTIONS"
          : section === "resources"
            ? "RESOURCE OBJECTS"
            : "INDIRECT OBJECTS"}
        <span>
          {section === "pages"
            ? (document?.pages.length ?? 0)
            : listedObjects.length}
        </span>
      </div>
      {section === "pages" && document ? (
        <PageTree
          document={document}
          objects={objectMap}
          selectedId={selection.id}
          state={pageTreeState}
          onStateChange={setPageTreeState}
          onNavigate={(id, trail) => {
            visit({ id, tab: "properties", section: "pages", trail })
            setMobilePane("inspector")
          }}
        />
      ) : (
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
      )}
      <SessionBookmarks
        bookmarks={bookmarks}
        saved={bookmarksSaved}
        onVisit={(saved) => {
          visit(saved)
          setMobilePane(saved.range ? "bytes" : "inspector")
        }}
        onNote={(key, note) =>
          updateBookmarks((current) =>
            current.map((bookmark) =>
              bookmark.key === key ? { ...bookmark, note } : bookmark
            )
          )
        }
        onRemove={(key) =>
          updateBookmarks((current) =>
            current.filter((bookmark) => bookmark.key !== key)
          )
        }
      />
    </aside>
  )

  const pageRotation = useMemo(
    () =>
      document?.locked
        ? "Locked"
        : pageRotationSummary(document?.pages ?? [], objectMap),
    [document, objectMap]
  )

  const overview = (
    <div className="overview inspector-scroll" {...overviewScroll}>
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
                  ? ` (catalogue ${document.catalogVersion})`
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
              <dt>Page rotation</dt>
              <dd>{pageRotation}</dd>
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
          {document.encrypted && !document.locked && (
            <p role="status" className="text-xs text-muted-foreground">
              Encrypted PDF unlocked locally. Properties and decoded streams are
              decrypted. Source and raw streams show the original encrypted
              bytes.
            </p>
          )}
          {document.locked && (
            <div className="warning-inline">
              <LockKeyhole size={16} />
              <div className="min-w-0 flex-1 space-y-3">
                <p>
                  This PDF is encrypted.{" "}
                  {document.encryptionError ??
                    "Enter its opening or owner password to inspect the structure."}{" "}
                  Original bytes remain available.
                </p>
                {!document.encryptionError && (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    aria-label="Unlock PDF"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const form = event.currentTarget
                      const password = new FormData(form).get(
                        "password"
                      ) as string
                      void unlock(password)
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <label
                        htmlFor="pdf-password"
                        className="text-xs font-medium"
                      >
                        PDF password
                      </label>
                      <Input
                        id="pdf-password"
                        name="password"
                        type="password"
                        autoComplete="off"
                        disabled={unlocking}
                        aria-invalid={Boolean(unlockError)}
                        aria-describedby={
                          unlockError
                            ? "pdf-password-help pdf-password-error"
                            : "pdf-password-help"
                        }
                      />
                    </div>
                    <Button type="submit" disabled={unlocking}>
                      {unlocking ? "Unlocking…" : "Unlock PDF"}
                    </Button>
                    <p
                      id="pdf-password-help"
                      className="w-full text-xs text-muted-foreground"
                    >
                      The password stays in memory for this document and is
                      cleared when you close it.
                    </p>
                  </form>
                )}
                {unlockError && (
                  <p id="pdf-password-error" role="alert" className="text-xs">
                    {unlockError}
                  </p>
                )}
              </div>
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
                  Document catalogue
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
          <section className="issues-overview">
            <h2>Issues</h2>
            {document.locked ? (
              <p>Structure checks unavailable while locked.</p>
            ) : (
              <IssueSummary issues={issues} />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => chooseSection("issues")}
            >
              View issues and coverage
            </Button>
          </section>
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

  const objectInspector = selected ? (
    <ObjectInspector
      object={selected}
      scrollPositionRef={viewports.inspector}
      tab={selection.tab}
      resources={
        selected.kind === "Page"
          ? effectiveResources(selected, objectMap)
          : undefined
      }
      onTabChange={(tab) => navigate(selected.id, tab)}
      onNavigate={followReference}
      onInspect={(id) => navigate(id)}
      objects={objectMap}
      downloadIndex={downloadIndex}
      pages={document?.pages}
      contextPageId={
        [...(selection.trail ?? [])]
          .reverse()
          .find((step) => step.id !== null && document?.pages.includes(step.id))
          ?.id ?? undefined
      }
      readStream={readStream}
      extractStream={extractStream}
      extractImage={extractImage}
    />
  ) : null

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
                  : section === "issues"
                    ? "Issues"
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
            password={previewPassword}
            pageNumber={previewPage}
            onPageChange={setPreviewPage}
          />
        </Suspense>
      ) : selected ? (
        <div className="inspection-detail-stack min-h-0 flex-1">
          {pinnedId && objectMap.has(pinnedId) ? (
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="40%" minSize="20%">
                <ObjectComparison
                  pinned={objectMap.get(pinnedId)!}
                  current={selected}
                  onUnpin={() => setPinnedId(null)}
                  onNavigate={(id) => navigate(id)}
                />
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="comparison-divider"
                aria-label="Resize comparison and inspector"
                title="Drag to resize · use arrow keys when focused"
              />
              <ResizablePanel defaultSize="60%" minSize="25%">
                {objectInspector}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            objectInspector
          )}
        </div>
      ) : section === "issues" && document ? (
        <IssuesPanel
          key={filename}
          issues={issues}
          limit={viewports.issueLimit}
          onLimitChange={(issueLimit) =>
            setViewportHistory((entries) =>
              entries.map((entry, index) =>
                index === historyIndex ? { ...entry, issueLimit } : entry
              )
            )
          }
          scrollPositionRef={viewports.inspector}
          locked={document.locked}
          recovered={document.recovered}
          onNavigate={(id) => navigate(id)}
          onStructure={() => chooseSection("structure")}
        />
      ) : section === "resources" && document ? (
        <ResourceBrowser
          scrollPositionRef={viewports.inspector}
          limit={viewports.resourceLimit}
          onLimitChange={(resourceLimit) =>
            setViewportHistory((entries) =>
              entries.map((entry, index) =>
                index === historyIndex ? { ...entry, resourceLimit } : entry
              )
            )
          }
          document={document}
          objectMap={objectMap}
          extractStream={extractStream}
          extractImage={extractImage}
          resources={resourceEntries}
          category={resourceCategory}
          onCategoryChange={setResourceCategory}
          filter={resourceFilter}
          onFilterChange={setResourceFilter}
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
        <header
          className={path !== "/" ? "app-header content-header" : "app-header"}
        >
          <a
            className="app-identity"
            href={import.meta.env.BASE_URL}
            onClick={(event) => {
              if (!followLink(event)) return
              if (document) {
                navigate(null, "properties", "overview")
              }
            }}
          >
            <span className="app-mark">
              <BrandIcon />
            </span>
            <span>PDF Internals</span>
          </a>
          {path !== "/" ? (
            <>
              <ContentHeaderLinks
                path={sitePage(path)!.path}
                onFollowLink={followLink}
              />
              {filename && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={endSession}
                  aria-label={busy ? "Cancel opening PDF" : "Close PDF"}
                  title={busy ? "Cancel opening PDF" : "Close PDF"}
                >
                  <X size={15} aria-hidden="true" />
                </Button>
              )}
            </>
          ) : (
            <>
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
                <a
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  href="/guide"
                  aria-label="User guide"
                  title="User guide"
                  onClick={followLink}
                >
                  <BookOpen size={15} aria-hidden="true" />{" "}
                  <span className="header-action-label">User guide</span>
                </a>
                {filename && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={endSession}
                    aria-label={busy ? "Cancel opening PDF" : "Close PDF"}
                    title={busy ? "Cancel opening PDF" : "Close PDF"}
                  >
                    <X size={15} aria-hidden="true" />
                    <span className="header-action-label">
                      {busy ? "Cancel opening PDF" : "Close PDF"}
                    </span>
                  </Button>
                )}
                {!filename && (
                  <Button
                    onClick={() => input.current?.click()}
                    size="sm"
                    aria-label="Open PDF"
                    title="Open PDF"
                  >
                    <FolderOpen size={15} aria-hidden="true" />
                    <span className="header-action-label">Open PDF</span>
                  </Button>
                )}
              </div>
            </>
          )}
          <ThemeControl />
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
        {about ? (
          <AboutPage onFollowLink={followLink} />
        ) : path !== "/" ? (
          <PublicPage
            key={path}
            page={sitePage(path)!}
            onFollowLink={followLink}
          />
        ) : bytes.length || busy ? (
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
                      : section === "issues"
                        ? "Issues"
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
                  <span role="status">
                    {searching
                      ? "Searching…"
                      : `${searchResults.length} match${searchResults.length === 1 ? "" : "es"}`}
                    {` · ${resultsScope === "text" ? "Latin-1 file bytes" : resultsScope === "decoded" ? "decoded streams" : resultsScope}`}
                  </span>
                  <div
                    className="search-result-navigation"
                    aria-label="Search result navigation"
                    role="group"
                  >
                    <span aria-live="polite" aria-atomic="true">
                      {searchResults.length
                        ? `${(activeSearchResult ?? 0) + 1} of ${searchResults.length}`
                        : "0 of 0"}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Previous search result"
                      title="Previous result"
                      disabled={searching || !searchResults.length}
                      onClick={() => moveSearchResult(-1)}
                    >
                      <ChevronUp size={14} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Next search result"
                      title="Next result"
                      disabled={searching || !searchResults.length}
                      onClick={() => moveSearchResult(1)}
                    >
                      <ChevronDown size={14} />
                    </Button>
                  </div>
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
                      ref={
                        index === activeSearchResult
                          ? activeSearchMatch
                          : undefined
                      }
                      aria-current={
                        index === activeSearchResult ? "true" : undefined
                      }
                      onClick={() => selectSearchResult(result, index)}
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
                <Button variant="ghost" size="xs" onClick={endSession}>
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
                      scrollPositionRef={viewports.bytes}
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
                      scrollPositionRef={viewports.bytes}
                      range={selectedRange}
                      onByteSelect={selectByte}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}
          </>
        ) : (
          <main className="empty-workspace" tabIndex={-1}>
            <div className="welcome-layout">
              <BrandArtwork className="welcome-artwork" />
              <div className="welcome-content">
                <div className="empty-introduction">
                  <span className="welcome-eyebrow">
                    Structure & byte explorer
                  </span>
                  <h1>
                    Look <span>inside</span> a PDF.
                  </h1>
                  <p>
                    An open-source, read-only PDF inspector for developers.
                    Explore PDF objects, follow references, and inspect raw or
                    decoded streams alongside the original bytes.
                  </p>
                  <div className="welcome-open-row">
                    <Button size="lg" onClick={() => input.current?.click()}>
                      <FilePlus2 size={16} />
                      Open a PDF<span className="shortcut">⌘ O</span>
                    </Button>
                    <span className="drop-hint">
                      or drop a file anywhere · up to 64 MiB
                    </span>
                  </div>
                  <div className="welcome-trust">
                    <span className="welcome-trust-badge welcome-trust-local">
                      <Shield size={16} aria-hidden="true" />
                      Processed locally
                    </span>
                    <span className="welcome-trust-badge">
                      <LockKeyhole size={16} aria-hidden="true" />
                      Read-only inspection
                    </span>
                  </div>
                </div>
                <section className="samples">
                  <h2>Start with a sample</h2>
                  <p className="samples-description">
                    No file handy? Explore a PDF made for learning.
                  </p>
                  {SAMPLES.map(({ file, name, detail, icon: Icon, tone }) => (
                    <button
                      className="sample-row"
                      data-tone={tone}
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
              </div>
            </div>
            <p className="welcome-note">
              From a page to its content stream to the bytes behind it.
              <br />
              Read-only exploration, with the source always in view.
              <span className="welcome-docs">
                <a href="/guide" onClick={followLink}>
                  Learn how to inspect a PDF
                </a>{" "}
                ·{" "}
                <a href="/examples" onClick={followLink}>
                  Worked examples
                </a>{" "}
                ·{" "}
                <a href="/guides/inspect-pdf-objects" onClick={followLink}>
                  Objects &amp; references
                </a>{" "}
                ·{" "}
                <a href="/guides/decode-pdf-streams" onClick={followLink}>
                  Decode streams
                </a>{" "}
                ·{" "}
                <a href="/guides/find-pdf-fonts-images" onClick={followLink}>
                  Fonts &amp; images
                </a>
              </span>
            </p>
          </main>
        )}
        {(path !== "/" || (!bytes.length && !busy)) && (
          <SiteLinks onFollowLink={followLink} />
        )}
        {path === "/" && (bytes.length > 0 || busy) && (
          <footer className="status-bar">
            <span>
              <ShieldCheck size={13} />
              Files stay on your device
              <span className="status-divider" aria-hidden="true" />
              <a
                className="status-limitations-link"
                href="/limitations"
                onClick={followLink}
              >
                Limitations
              </a>
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
        )}
        {dragging && (
          <div className="drop-overlay">
            <div className="drop-target">
              <div className="drop-mascot" aria-hidden="true">
                <BrandIcon />
              </div>
              <span className="drop-eyebrow">Ready to investigate</span>
              <p>Let’s look inside.</p>
              <span className="drop-instruction">
                Drop your PDF anywhere on this window
              </span>
              <div className="drop-overlay-privacy">
                <ShieldCheck size={14} aria-hidden="true" />
                Processed locally · up to 64 MiB
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
