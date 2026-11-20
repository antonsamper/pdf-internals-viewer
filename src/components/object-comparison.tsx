import { useState } from "react"
import { PinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PdfObjectRecord } from "@/lib/pdf/types"
import { compareObjects } from "@/lib/pdf/resource-tools"
import { ValueView } from "@/components/value-view"

function Location({ object }: { object: PdfObjectRecord }) {
  const source = object.provenance
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {source.type === "file"
        ? `Original file · 0x${source.range.start.toString(16)} · ${source.range.end - source.range.start} bytes`
        : source.type === "decoded"
          ? `Decoded container ${source.containerId} · offset ${source.range.start}`
          : `Source unknown · ${source.reason}`}
    </p>
  )
}
export function ObjectComparison({
  pinned,
  current,
  onUnpin,
  onNavigate,
}: {
  pinned: PdfObjectRecord
  current?: PdfObjectRecord
  onUnpin: () => void
  onNavigate: (id: string) => void
}) {
  const [differencesOnly, setDifferencesOnly] = useState(false)
  const rows = current ? compareObjects(pinned, current) : []
  return (
    <section
      aria-label="Object comparison"
      className="object-comparison min-w-0 border-t p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Compare objects</h2>
        <Button size="sm" variant="ghost" onClick={onUnpin}>
          <PinOff size={14} />
          Unpin object
        </Button>
      </div>
      <div className="my-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Pinned</p>
          <button
            className="reference font-mono"
            onClick={() => onNavigate(pinned.id)}
          >
            {pinned.id} obj · {pinned.kind}
          </button>
          <Location object={pinned} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          {current ? (
            <>
              <p className="font-mono text-xs">
                {current.id} obj · {current.kind}
              </p>
              <Location object={current} />
            </>
          ) : (
            <p className="text-xs">Select another object to compare.</p>
          )}
        </div>
      </div>
      {current && (
        <>
          <label className="mb-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={differencesOnly}
              onChange={(event) => setDifferencesOnly(event.target.checked)}
            />
            Show differences only
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            Dictionary/value comparison. Stream payloads and original syntax are
            not compared. Added and removed are relative to the pinned object.
          </p>
          {current.id === pinned.id ? (
            <p className="text-xs">Select another object to see differences.</p>
          ) : (
            <div className="divide-y">
              {rows
                .filter((row) => !differencesOnly || row.status !== "same")
                .map((row) => (
                  <div key={row.key} className="py-3">
                    <div className="mb-2 flex gap-2 text-xs">
                      <code className="break-all">{row.key}</code>
                      <span className="text-muted-foreground">
                        {row.status}
                      </span>
                    </div>
                    <div
                      className={`grid min-w-0 gap-3 sm:grid-cols-2 ${row.status !== "same" ? "bg-muted/50" : ""}`}
                    >
                      <div className="min-w-0 overflow-auto p-2">
                        <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                          Pinned
                        </span>
                        {row.left ? (
                          <ValueView value={row.left} onNavigate={onNavigate} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Absent
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 overflow-auto p-2">
                        <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                          Current
                        </span>
                        {row.right ? (
                          <ValueView
                            value={row.right}
                            onNavigate={onNavigate}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Absent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              {differencesOnly &&
                rows.every((row) => row.status === "same") && (
                  <p className="text-xs">No dictionary/value differences.</p>
                )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
