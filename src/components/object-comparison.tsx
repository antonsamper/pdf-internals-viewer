import { PinOff } from 'lucide-react';
import { useState } from 'react';

import type { PdfObjectRecord } from '@/lib/pdf/types';

import { ReferenceButton } from '@/components/inspector/reference-button';
import { Button } from '@/components/ui/button';
import { ValueView } from '@/components/value-view';
import { compareObjects } from '@/lib/pdf/resource-tools';
import { cn } from '@/lib/utils';

const Location = function Location({ object }: { object: PdfObjectRecord }) {
  const source = object.provenance;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {source.type === 'file'
        ? `Original file · 0x${source.range.start.toString(16)} · ${source.range.end - source.range.start} bytes`
        : source.type === 'decoded'
          ? `Decoded container ${source.containerId} · offset ${source.range.start}`
          : `Source unknown · ${source.reason}`}
    </p>
  );
};
export const ObjectComparison = function ObjectComparison({
  pinned,
  current,
  onUnpin,
  onNavigate,
}: {
  pinned: PdfObjectRecord;
  current?: PdfObjectRecord;
  onUnpin: () => void;
  onNavigate: (id: string) => void;
}) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const rows = current ? compareObjects(pinned, current) : [];
  return (
    <section aria-label="Object comparison" className="h-full min-w-0 overflow-auto border-t p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-small leading-[calc(1.25/0.875)] font-[550]">Compare objects</h2>
        <Button size="sm" variant="ghost" onClick={onUnpin}>
          <PinOff size={14} />
          Unpin object
        </Button>
      </div>
      <div className="my-3 grid gap-4 min-w600:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Pinned</p>
          <ReferenceButton
            onClick={() => {
              return onNavigate(pinned.id);
            }}
          >
            {pinned.id} obj · {pinned.kind}
          </ReferenceButton>
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
              onChange={(event) => {
                return setDifferencesOnly(event.target.checked);
              }}
            />
            Show differences only
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            Compares dictionary keys and values. Stream bytes and original syntax are not compared. Added and removed describe changes from
            the pinned object to the current object.
          </p>
          {current.id === pinned.id ? (
            <p className="text-xs">Select another object to see differences.</p>
          ) : (
            <div className="divide-y">
              {rows
                .filter((row) => {
                  return !differencesOnly || row.status !== 'same';
                })
                .map((row) => {
                  return (
                    <div key={row.key} className="py-3">
                      <div className="mb-2 flex gap-2 text-xs">
                        <code className="break-all">{row.key}</code>
                        <span className="text-muted-foreground">{row.status}</span>
                      </div>
                      <div className={cn('grid min-w-0 gap-3 min-w600:grid-cols-2', row.status !== 'same' && 'bg-muted/50')}>
                        <div className="min-w-0 overflow-auto p-2">
                          <span className="mb-1 block text-xs text-muted-foreground min-w600:hidden">Pinned</span>
                          {row.left ? (
                            <ValueView key={pinned.id} value={row.left} onNavigate={onNavigate} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Absent</span>
                          )}
                        </div>
                        <div className="min-w-0 overflow-auto p-2">
                          <span className="mb-1 block text-xs text-muted-foreground min-w600:hidden">Current</span>
                          {row.right ? (
                            <ValueView key={current?.id} value={row.right} onNavigate={onNavigate} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Absent</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              {differencesOnly &&
                rows.every((row) => {
                  return row.status === 'same';
                }) && <p className="text-xs">No dictionary/value differences.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
};
