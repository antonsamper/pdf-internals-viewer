import { cn } from 'cn';
import { Download, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { EmbeddedDownload } from '@/lib/pdf/downloads';
import type { PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { DownloadSize } from '@/components/download-size';
import { REPRESENTATION_NOTE, WARNING_INLINE } from '@/components/inspector-styles';
import { Button } from '@/components/ui/button';
import { saveFile } from '@/lib/save-file';
export const EmbeddedDownloads = ({
  className,
  object,
  assets,
  extractStream,
}: {
  className?: string;
  object: PdfObjectRecord;
  assets: EmbeddedDownload[];
  extractStream: (id: string, purpose?: 'download' | 'size') => Promise<StreamResult>;
}) => {
  const download = async (asset: EmbeddedDownload) => {
    const token = ++request.current;
    setPending(asset.streamId);
    setError(null);
    try {
      const result = await extractStream(asset.streamId);
      if (token !== request.current) return;
      if (result.error) throw new Error(result.error);
      if (result.truncated) throw new Error('The stream is incomplete. No file was downloaded.');
      saveFile(
        new Blob([new Uint8Array(result.bytes)], {
          type: 'application/octet-stream',
        }),
        asset.filename
      );
    } catch (reason) {
      if (token === request.current) setError(reason instanceof Error ? reason.message : 'Could not extract the embedded file.');
    } finally {
      if (token === request.current) setPending(null);
    }
  };
  const request = useRef(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      // oxlint-disable-next-line react/exhaustive-effect-dependencies -- object identity is the trigger that cancels in-flight extractions.
      request.current++;
    },
    [object]
  );
  const hasFont = assets.some((asset) => asset.kind === 'font');
  return (
    <section className={cn('mx-[22px] mb-4 rounded-[8px] border bg-sidebar p-3', className)} aria-label="Embedded file downloads">
      {assets.map((asset) => (
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 not-first:mt-3"
          key={`${asset.kind}-${asset.streamId}-${asset.filename}`}
        >
          <div className="flex min-w-0 flex-col gap-[3px]">
            <strong className="text-[12px] font-medium [overflow-wrap:anywhere]">{asset.filename}</strong>
            <span className="text-[10px] text-muted-foreground">
              {asset.kind === 'font' ? (asset.subset ? 'Embedded font · subset indicated' : 'Embedded font') : 'Embedded attachment'}
            </span>
            <DownloadSize id={asset.streamId} extractStream={extractStream} />
          </div>
          <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => void download(asset)}>
            {pending === asset.streamId ? (
              <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {pending === asset.streamId ? 'Extracting…' : asset.kind === 'font' ? 'Download font' : 'Download attachment'}
          </Button>
        </div>
      ))}
      {hasFont && (
        <p className={cn(REPRESENTATION_NOTE, 'mt-2.5 mb-0 text-[11px] leading-[1.7]')}>
          Fonts may be partial: an embedded font can contain only the characters used in this PDF. Downloading it does not restore the
          complete original font. Some extracted font programs are not directly installable.
        </p>
      )}
      {error && (
        <p className={WARNING_INLINE} role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
