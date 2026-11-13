import { useEffect, useState } from "react"
import { ArrowUpRight, Braces, FileCode2, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ValueView } from "@/components/value-view"
import { ContentStreamView } from "@/components/content-stream-view"
import type { PdfObjectRecord, PdfValue, StreamResult } from "@/lib/pdf/types"

export type InspectorTab = "properties" | "source" | "raw" | "decoded"
export function ObjectInspector({
  object,
  tab,
  onTabChange,
  onNavigate,
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
  readStream: (id: string, mode: "raw" | "decoded") => Promise<StreamResult>
}) {
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
              References <span>{object.references.length}</span>
            </h2>
            <div className="reference-list">
              {object.references.length ? (
                object.references.map((id) => (
                  <Button
                    size="sm"
                    variant="outline"
                    key={id}
                    onClick={() => onNavigate(id)}
                    className="font-mono"
                  >
                    {id} R<ArrowUpRight size={12} />
                  </Button>
                ))
              ) : (
                <p className="muted">No outgoing references.</p>
              )}
            </div>
            <h2>
              Referenced by <span>{object.referencedBy.length}</span>
            </h2>
            <div className="reference-list">
              {object.referencedBy.length ? (
                object.referencedBy.map((id) => (
                  <Button
                    size="sm"
                    variant="outline"
                    key={id}
                    onClick={() => onNavigate(id)}
                    className="font-mono"
                  >
                    {id} obj
                    <ArrowUpRight size={12} />
                  </Button>
                ))
              ) : (
                <p className="muted">
                  No incoming references in the indexed object set.
                </p>
              )}
            </div>
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
