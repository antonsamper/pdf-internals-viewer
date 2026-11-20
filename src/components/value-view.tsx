import { ChevronRight, Info } from "lucide-react"
import { useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PdfObjectRecord, PdfValue } from "@/lib/pdf/types"

const explanations: Record<string, string> = {
  Type: "The kind of object this dictionary describes.",
  Contents:
    "Drawing instructions used to construct this page. May point to one stream or an array of streams.",
  Resources:
    "Fonts, images, and other named resources available to this page or form.",
  Parent:
    "The parent node in the page tree. Page attributes may be inherited from ancestors.",
  Kids: "Child nodes in the page tree. References may lead to pages or intermediate nodes.",
  Filter:
    "The decoding filters applied to this stream, in the order needed to decode it.",
  Length:
    "The stored length of the stream data, in bytes. May be an indirect reference.",
  Root: "The document catalog: the starting point for exploring the logical document.",
  Pages: "The root of the page tree.",
  Prev: "The original byte offset of the preceding cross-reference section.",
  MediaBox: "The page boundary rectangle, measured in PDF user-space units.",
  Font: "Named font resources used by content streams.",
  XObject: "Named external objects, such as images and reusable form content.",
}

export function ValueView({
  value,
  onNavigate,
  depth = 0,
  objects,
  ancestors = [],
  path = [],
  referenceDepth = 0,
}: {
  value: PdfValue
  onNavigate: (id: string, path?: string[]) => void
  depth?: number
  objects?: Map<string, PdfObjectRecord>
  ancestors?: string[]
  path?: string[]
  referenceDepth?: number
}) {
  if (depth > 12)
    return (
      <span className="muted">
        Expand this object in Source to inspect deeper nesting.
      </span>
    )
  if (value.type === "reference") {
    const target = objects?.get(value.ref)
    const cycle = ancestors.includes(value.ref)
    return (
      <span className="inline-reference">
        <button
          className="reference"
          onClick={() => onNavigate(value.ref, path)}
          title={`Open object ${value.ref} in the inspector`}
        >
          {value.text}
          <ChevronRight size={12} />
        </button>
        {objects && !target ? (
          <span className="muted"> · unavailable reference</span>
        ) : cycle ? (
          <span className="muted"> · already in this path</span>
        ) : target && referenceDepth < 4 && depth < 12 ? (
          <InlineReference
            key={value.ref}
            target={target}
            onNavigate={onNavigate}
            objects={objects}
            ancestors={ancestors}
            path={path}
            referenceDepth={referenceDepth}
            depth={depth}
          />
        ) : target ? (
          <span className="muted">
            {" "}
            · inline depth limit; open object to continue
          </span>
        ) : null}
      </span>
    )
  }
  if (value.type === "dictionary" || value.type === "stream")
    return (
      <div className="pdf-dictionary">
        {value.entries.length === 0 && (
          <span className="muted">Empty dictionary</span>
        )}
        {value.entries.map(({ key, value: child }, index) => {
          const bareKey = key.replace(/^\//, "")
          return (
            <div className="pdf-entry" key={`${key}-${index}`}>
              <div className="pdf-key">
                <span>/{bareKey}</span>
                {explanations[bareKey] && (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={`Explain /${bareKey}`}
                      className="key-help"
                    >
                      <Info size={12} />
                    </TooltipTrigger>
                    <TooltipContent>{explanations[bareKey]}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="pdf-value">
                <ValueView
                  value={child}
                  onNavigate={onNavigate}
                  depth={depth + 1}
                  objects={objects}
                  ancestors={ancestors}
                  path={[...path, `/${bareKey}`]}
                  referenceDepth={referenceDepth}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  if (value.type === "array")
    return (
      <div className="pdf-array">
        <span className="syntax">[</span>
        {value.items.map((child, index) => (
          <ValueView
            key={index}
            value={child}
            onNavigate={onNavigate}
            depth={depth + 1}
            objects={objects}
            ancestors={ancestors}
            path={[...path, `[${index}]`]}
            referenceDepth={referenceDepth}
          />
        ))}
        <span className="syntax">]</span>
      </div>
    )
  return <span className={`pdf-scalar pdf-${value.type}`}>{value.text}</span>
}

function InlineReference({
  target,
  onNavigate,
  objects,
  ancestors,
  path,
  referenceDepth,
  depth,
}: {
  target: PdfObjectRecord
  onNavigate: (id: string, path?: string[]) => void
  objects?: Map<string, PdfObjectRecord>
  ancestors: string[]
  path: string[]
  referenceDepth: number
  depth: number
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <details
      className="inline-reference-details"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Expand {target.id} inline</summary>
      {expanded && (
        <div className="inline-reference-body">
          <p className="representation-note">
            {target.label} ·{" "}
            {target.provenance.type === "file"
              ? "Original-file object"
              : target.provenance.type === "decoded"
                ? "Decoded object-stream member"
                : "Source location unknown"}
          </p>
          <ValueView
            value={target.value}
            onNavigate={onNavigate}
            objects={objects}
            ancestors={[...ancestors, target.id]}
            path={path}
            referenceDepth={referenceDepth + 1}
            depth={depth + 1}
          />
        </div>
      )}
    </details>
  )
}
