import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Braces, FileCode2, LoaderCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ValueView } from "@/components/value-view"
import { ContentStreamView } from "@/components/content-stream-view"
import {
  objectName,
  objectRelationships,
  objectSummary,
} from "@/lib/pdf/object-context"
import type { PdfObjectRecord, PdfValue, StreamResult } from "@/lib/pdf/types"

export type InspectorTab = "properties" | "source" | "raw" | "decoded"
export function ObjectInspector({
  object,
  tab,
  onTabChange,
  onNavigate,
  onInspect,
  readStream,
  resources,
  objects,
  pages = [],
  contextPageId,
}: {
  object: PdfObjectRecord
  resources?: { value: PdfValue; inheritedFrom?: string }
  objects?: Map<string, PdfObjectRecord>
  pages?: string[]
  contextPageId?: string
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  onNavigate: (id: string, path?: string[]) => void
  onInspect: (id: string) => void
  readStream: (id: string, mode: "raw" | "decoded") => Promise<StreamResult>
}) {
  const relationships = useMemo(
    () => objectRelationships(object, objects ?? new Map()),
    [object, objects]
  )
  const summary = objectSummary(
    object,
    pages,
    relationships.incoming,
    objects ?? new Map()
  )
  const [state, setState] = useState<{
    object: PdfObjectRecord
    tab: InspectorTab
    result?: StreamResult
    error?: string
  } | null>(null)
  const stream =
    state?.object === object && state.tab === tab ? state.result : undefined
  const error =
    state?.object === object && state.tab === tab ? state.error : undefined
  useEffect(() => {
    if (!object.stream || (tab !== "raw" && tab !== "decoded")) return
    let active = true
    readStream(object.id, tab)
      .then((result) => {
        if (active) setState({ object, tab, result })
      })
      .catch((reason) => {
        if (active)
          setState({
            object,
            tab,
            error:
              reason instanceof Error
                ? reason.message
                : "Could not read stream.",
          })
      })
    return () => {
      active = false
    }
  }, [object, tab, readStream])
  const safeTab =
    !object.stream && (tab === "raw" || tab === "decoded") ? "properties" : tab
  return (
    <section className="inspector" aria-label="Object inspector">
      <header className="object-heading">
        <div className="object-title">
          <Braces size={19} />
          <h1>
            {object.id} <span>obj</span>
          </h1>
          <Badge variant="secondary">{object.kind}</Badge>
        </div>
        <p>{object.label}</p>
        <p className="object-explanation">{summary}</p>
      </header>
      <div className="provenance">
        <FileCode2 size={14} />
        {object.provenance.type === "file" ? (
          <span>
            Original file ·{" "}
            <code>
              0x{object.provenance.range.start.toString(16).toUpperCase()}
            </code>{" "}
            · {object.provenance.range.end - object.provenance.range.start}{" "}
            bytes
          </span>
        ) : object.provenance.type === "decoded" ? (
          <span>
            Decoded object stream{" "}
            <button
              className="reference"
              onClick={() => {
                if (object.provenance.type === "decoded")
                  onNavigate(object.provenance.containerId)
              }}
            >
              {object.provenance.containerId}
              <ArrowUpRight size={12} />
            </button>{" "}
            · offset {object.provenance.range.start}
          </span>
        ) : (
          <span>Source location unknown · {object.provenance.reason}</span>
        )}
      </div>
      {object.warnings.map((warning, i) => (
        <p className="warning-inline" key={i}>
          {warning}
        </p>
      ))}
      <Tabs
        value={safeTab}
        onValueChange={(value) => onTabChange(value as InspectorTab)}
        className="inspector-tabs"
      >
        <TabsList variant="line" className="inspector-tab-list">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          {object.stream && (
            <>
              <TabsTrigger value="raw">Raw stream</TabsTrigger>
              <TabsTrigger value="decoded">Decoded</TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="properties" className="inspector-scroll">
          <ValueView
            key={object.id}
            value={object.value}
            onNavigate={onNavigate}
            objects={objects}
            ancestors={[object.id]}
          />
          <section className="relationship-section">
            {resources && (
              <>
                <h2>Effective page resources</h2>
                {resources.inheritedFrom ? (
                  <p className="representation-note">
                    Inherited from{" "}
                    <button
                      className="reference"
                      onClick={() => onNavigate(resources.inheritedFrom!)}
                    >
                      {resources.inheritedFrom} R
                    </button>
                    . This entry is derived from the page tree.
                  </p>
                ) : (
                  <p className="representation-note">Defined on this page.</p>
                )}
                <ValueView
                  key={`${object.id}-resources`}
                  value={resources.value}
                  onNavigate={
                    resources.inheritedFrom
                      ? (id) => onNavigate(id)
                      : onNavigate
                  }
                  objects={objects}
                  ancestors={[object.id]}
                  path={["/Resources"]}
                />
              </>
            )}
            <h2>
              References{" "}
              <span>
                {object.references.length}{" "}
                {object.references.length === 1 ? "object" : "objects"}
              </span>
            </h2>
            <div className="relationship-links">
              {relationships.outgoing.map((link, index) => (
                <button
                  className="relationship-link"
                  key={index}
                  onClick={() => onNavigate(link.targetId, link.path)}
                >
                  <span className="relationship-path">
                    {link.path.join(" → ") || "Direct reference"}
                  </span>
                  <span>
                    {objectName(link.targetId, objects ?? new Map(), pages)} ·{" "}
                    <code>{link.targetId} R</code>
                    <ArrowUpRight size={12} />
                  </span>
                </button>
              ))}
              {!relationships.outgoing.length && (
                <p className="muted">
                  {object.references.length
                    ? "Reference paths unavailable in the inspected value."
                    : "No outgoing references."}
                </p>
              )}
            </div>
            <h2>
              Referenced by{" "}
              <span>
                {object.referencedBy.length}{" "}
                {object.referencedBy.length === 1 ? "object" : "objects"}
              </span>
            </h2>
            <div className="relationship-links">
              {relationships.incoming.map((link, index) => (
                <button
                  className="relationship-link"
                  key={index}
                  onClick={() => onInspect(link.sourceId)}
                >
                  <span>
                    {objectName(link.sourceId, objects ?? new Map(), pages)} ·{" "}
                    <code>{link.sourceId} obj</code>
                    <ArrowUpRight size={12} />
                  </span>
                  <span className="relationship-path">
                    via {link.path.join(" → ") || "a direct reference"}
                  </span>
                </button>
              ))}
              {!relationships.incoming.length && (
                <p className="muted">
                  {object.referencedBy.length
                    ? "Incoming reference paths unavailable in the inspected values."
                    : "No incoming references in the indexed object set."}
                </p>
              )}
            </div>
            {relationships.incomplete && (
              <p className="representation-note">
                Relationship details are incomplete: inspection is bounded to
                200 paths per direction, 200 incoming objects, 5,000 values per
                object, and 32 nested levels. Object counts above describe the
                indexed references.
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent value="source" className="inspector-scroll">
          <p className="representation-note">
            {object.provenance.type === "file"
              ? "Original object syntax. Hex remains the authoritative byte representation."
              : object.provenance.type === "decoded"
                ? "Object syntax from its decoded container. These are not original file bytes."
                : "Reconstructed representation. Exact source syntax is unavailable."}
          </p>
          <pre className="source-code">{object.source}</pre>
        </TabsContent>
        {(["raw", "decoded"] as const).map(
          (mode) =>
            object.stream && (
              <TabsContent key={mode} value={mode} className="inspector-scroll">
                <div className="stream-info">
                  <span>
                    {mode === "raw"
                      ? "Stored stream bytes"
                      : "Decoded stream bytes"}
                  </span>
                  <Badge variant="outline">
                    {object.stream.filters.join(" → ") || "No filters"}
                  </Badge>
                </div>
                <p className="representation-note">
                  Byte text (Latin-1 display), not extracted page text.{" "}
                  {mode === "decoded" &&
                    "Decoded offsets differ from original file offsets."}
                </p>
                {error ? (
                  <p role="alert" className="warning-inline">
                    {error}
                  </p>
                ) : stream ? (
                  <>
                    {stream.error && (
                      <p role="alert" className="warning-inline">
                        {stream.error}
                      </p>
                    )}
                    <p className="stream-size">
                      {stream.bytes.length.toLocaleString()} bytes
                      {stream.truncated ? " · display truncated" : ""}
                    </p>
                    {mode === "decoded" && objects && !stream.error ? (
                      <ContentStreamView
                        key={object.id}
                        object={object}
                        stream={stream}
                        objects={objects}
                        pages={pages}
                        contextPageId={contextPageId}
                        onNavigate={onNavigate}
                      />
                    ) : (
                      <pre className="source-code">{stream.text}</pre>
                    )}
                  </>
                ) : (
                  <p className="loading-inline">
                    <LoaderCircle size={15} className="animate-spin" />
                    Reading stream…
                  </p>
                )}
              </TabsContent>
            )
        )}
      </Tabs>
    </section>
  )
}
