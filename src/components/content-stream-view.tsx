import { Fragment, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  contentInstructions,
  explainInstruction,
  namedResource,
  resourceCategory,
  resourceContexts,
} from "@/lib/pdf/content-stream"
import type { PdfObjectRecord, StreamResult } from "@/lib/pdf/types"

export function ContentStreamView({
  object,
  stream,
  objects,
  pages,
  contextPageId,
  onNavigate,
}: {
  object: PdfObjectRecord
  stream: StreamResult
  objects: Map<string, PdfObjectRecord>
  pages: string[]
  contextPageId?: string
  onNavigate: (id: string, path?: string[]) => void
}) {
  const [readable, setReadable] = useState(true)
  const [chosenContext, setChosenContext] = useState<string | null>(null)
  const contexts = useMemo(
    () => resourceContexts(object, objects, pages, contextPageId),
    [object, objects, pages, contextPageId]
  )
  const parsed = useMemo(() => contentInstructions(stream.text), [stream.text])
  const defaultContext =
    contexts.length === 1
      ? contexts[0].id
      : (contexts.find((entry) => entry.id === contextPageId)?.id ?? "")
  const context = contexts.find(
    (entry) => entry.id === (chosenContext ?? defaultContext)
  )
  if (!contexts.length) return <pre className="source-code">{stream.text}</pre>

  return (
    <div className="content-stream-view">
      <div
        className="content-stream-toolbar"
        aria-label="Decoded stream representation"
      >
        <Button
          size="sm"
          variant={readable ? "secondary" : "ghost"}
          aria-pressed={readable}
          onClick={() => setReadable(true)}
        >
          Readable instructions
        </Button>
        <Button
          size="sm"
          variant={!readable ? "secondary" : "ghost"}
          aria-pressed={!readable}
          onClick={() => setReadable(false)}
        >
          Decoded byte text
        </Button>
      </div>
      {!readable ? (
        <pre className="source-code">{stream.text}</pre>
      ) : (
        <>
          <p className="representation-note">
            Instruction offsets are within this decoded stream, not the original
            file. Strings retain PDF syntax and font encoding; this is not
            extracted text.
          </p>
          {contexts.length > 1 ? (
            <label className="content-context-label">
              Resource context
              <select
                aria-label="Content resource context"
                value={context?.id ?? ""}
                onChange={(event) => setChosenContext(event.target.value)}
              >
                <option value="">
                  Choose a page to resolve resource names
                </option>
                {contexts.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="representation-note">
              {context?.label}.{" "}
              {!context?.resources &&
                "Resource dictionary unavailable; resource names cannot be resolved."}
            </p>
          )}
          {contexts.length > 1 && !context && (
            <p className="warning-inline">
              This stream is shared by multiple pages. Choose a context before
              following resource names.
            </p>
          )}
          {(stream.truncated || parsed.incomplete) && (
            <p className="warning-inline">
              Instruction interpretation is incomplete. Use Decoded byte text to
              inspect the available bytes.
            </p>
          )}
          <ol
            className="content-instructions"
            aria-label="Content stream instructions"
          >
            {parsed.instructions.map((instruction) => (
              <li className="content-instruction" key={instruction.start}>
                <span className="content-offset" title="Decoded byte offset">
                  0x{instruction.start.toString(16).toUpperCase()}
                </span>
                <code className="content-syntax">
                  {instruction.tokens.map((token, index) => {
                    const category =
                      token.kind === "name"
                        ? resourceCategory(
                            instruction.operator,
                            index,
                            instruction.tokens.length - 1
                          )
                        : undefined
                    const resource = category
                      ? namedResource(context, category, token.text, objects)
                      : undefined
                    const builtInColor =
                      category === "ColorSpace" &&
                      [
                        "/DeviceGray",
                        "/DeviceRGB",
                        "/DeviceCMYK",
                        "/Pattern",
                      ].includes(token.text)
                    return (
                      <Fragment key={token.start}>
                        {index > 0 &&
                          stream.text.slice(
                            instruction.tokens[index - 1].end,
                            token.start
                          )}
                        {resource?.id ? (
                          <button
                            className="reference resource-token"
                            aria-label={`Inspect ${token.text} resource`}
                            title={`${context?.label} · /${category} · ${resource.id} R`}
                            onClick={() => onNavigate(resource.id!)}
                          >
                            {token.text}
                          </button>
                        ) : (
                          <span
                            className={
                              token.kind === "operator"
                                ? "operator-token"
                                : token.kind === "name"
                                  ? "name-token"
                                  : token.kind === "number"
                                    ? "number-token"
                                    : "value-token"
                            }
                            title={
                              category && !builtInColor
                                ? resource
                                  ? "Direct resource value; inspect its resource dictionary for details."
                                  : "Resource unresolved in the selected context."
                                : undefined
                            }
                          >
                            {token.text}
                          </span>
                        )}
                      </Fragment>
                    )
                  })}
                </code>
                <p className="content-explanation">
                  {explainInstruction(instruction)}
                </p>
              </li>
            ))}
          </ol>
          {!parsed.instructions.length && (
            <p className="muted">
              No complete drawing instructions in the available stream bytes.
            </p>
          )}
        </>
      )}
    </div>
  )
}
