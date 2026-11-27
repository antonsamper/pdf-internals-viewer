import type { ReactNode } from 'react';

import { Download, LoaderCircle, ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { Warning } from '@/components/inspector/warning';
import { Button } from '@/components/ui/button';
import { fileSize } from '@/lib/file-size';
import { buildImageFile, imageThumbnail, queueImageWork } from '@/lib/image-export';
import { imageDownloadPlan } from '@/lib/pdf/image-download';
import { saveFile } from '@/lib/save-file';
import { useVisible } from '@/lib/use-visible';
import { cn } from '@/lib/utils';

/** The text in the preview placeholder, at a readable measure. */
const PreviewStatus = ({ children }: { children: ReactNode }) => <p className="max-w-[54ch] leading-[1.6]">{children}</p>;

/** The export plan for an image, or why it cannot be exported. */
const downloadPlan = (object: PdfObjectRecord) => {
  try {
    return { plan: imageDownloadPlan(object), unavailable: undefined };
  } catch (reason) {
    return { plan: undefined, unavailable: message(reason) };
  }
};

/** The thumbnail, or a placeholder while it loads or when it cannot be drawn. */
const ImagePreview = ({ error, image, objectId }: { error: string | undefined; image: string | undefined; objectId: string }) => {
  if (image)
    return (
      <img
        src={image}
        alt={`Image object ${objectId}`}
        className="my-3 block size-40 max-w-full rounded-md border bg-background object-contain p-2"
      />
    );
  return (
    <div
      className={cn(
        'my-3 flex items-center gap-2.5 p-3.5',
        'bg-sidebar text-detail text-muted-foreground',
        'rounded-md border border-dashed'
      )}
      role="status"
    >
      {error ? (
        <>
          <ImageOff aria-hidden="true" className="size-4.5 shrink-0" />
          <PreviewStatus>Preview unavailable: {error}</PreviewStatus>
        </>
      ) : (
        <>
          <LoaderCircle aria-hidden="true" className="size-4.5 shrink-0 animate-spin motion-reduce:animate-none" />
          <PreviewStatus>Loading image preview…</PreviewStatus>
        </>
      )}
    </div>
  );
};

/** The size of the exported file next to the stream's size in the PDF. */
const DownloadSize = ({ failed, object, size }: { failed: boolean; object: PdfObjectRecord; size: number | undefined }) => {
  let text = failed ? 'Download size unavailable' : 'Calculating download size…';
  if (size !== undefined) text = `Download: ${fileSize(size)}`;
  return (
    <div
      className="my-2.5 text-detail leading-[1.6] text-muted-foreground tabular-nums"
      data-image-file-size
      title={size !== undefined ? `${size.toLocaleString()} bytes` : undefined}
    >
      {text}
      {object.stream && <span> · In PDF: {fileSize(object.stream.length)}</span>}
    </div>
  );
};

const DownloadButton = ({ disabled, pending, onClick }: { disabled: boolean; pending: boolean; onClick: () => void }) => (
  <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
    {pending ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" />}
    {pending ? 'Exporting image…' : 'Download image'}
  </Button>
);

/** What the export keeps and drops for the image's format, or why there is no export. */
const exportNote = (plan: ReturnType<typeof imageDownloadPlan> | undefined, unavailable: string | undefined) => {
  if (unavailable) return `Image export unavailable: ${unavailable}`;
  return plan?.format === 'jpeg'
    ? 'JPEG · embedded file, without page masks, colour adjustments, or transforms.'
    : 'PNG · full image dimensions, without page transforms. Up to 4 megapixels / 4096 pixels per side.';
};

/** Whether an export error says something the preview and the format note don't already show. */
const showsDownloadError = (
  downloadError: string | null | undefined,
  unavailable: string | undefined,
  previewError: string | undefined,
  showPreview: boolean
) => !!downloadError && downloadError !== unavailable && (!showPreview || downloadError !== previewError);

export const ImageDownload = ({
  object,
  extractImage,
  showPreview = false,
}: {
  object: PdfObjectRecord;
  extractImage: (id: string) => Promise<StreamResult>;
  showPreview?: boolean;
}) => {
  const download = async () => {
    if (!plan) return;
    const token = ++request.current;
    setPending(true);
    setError(null);
    try {
      await queueImageWork(async () => {
        if (request.current !== token) return;
        const file = await buildImageFile(object, extractImage);
        if (request.current === token) {
          saveFile(file.blob, file.filename);
          setState((current) => ({ ...current, size: file.blob.size }));
        }
      });
    } catch (reason) {
      if (request.current === token) setError(message(reason));
    } finally {
      if (request.current === token) setPending(false);
    }
  };
  const { ref, visible } = useVisible();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<{
    size?: number;
    image?: string;
    previewError?: string;
    exportError?: string;
  }>({});
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- object identity is the trigger that invalidates in-flight requests.
    [object]
  );
  const { plan, unavailable } = downloadPlan(object);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    void queueImageWork(async () => {
      if (!active) return;
      try {
        const file = await buildImageFile(object, extractImage);
        if (!active) return;
        let image: string | undefined;
        let previewError: string | undefined;
        if (showPreview) {
          try {
            image = await imageThumbnail(object, file.blob);
          } catch (reason) {
            previewError = message(reason);
          }
        }
        if (active) setState({ image, previewError, size: file.blob.size });
      } catch (reason) {
        if (active)
          setState({
            exportError: message(reason),
            previewError: message(reason),
          });
      }
    });
    return () => {
      active = false;
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- effect reloads the thumbnail when any of these inputs change.
  }, [object, extractImage, showPreview, visible]);
  const previewError = unavailable ?? state.previewError;
  const downloadError = error ?? state.exportError;
  return (
    <div ref={ref}>
      {showPreview && <ImagePreview error={previewError} image={state.image} objectId={object.id} />}
      <DownloadSize failed={Boolean(unavailable || state.exportError)} object={object} size={state.size} />
      <DownloadButton disabled={pending || !plan} pending={pending} onClick={() => void download()} />
      <p className="mt-2 max-w-[54ch] text-xs leading-[1.6] text-muted-foreground">{exportNote(plan, unavailable)}</p>
      {showsDownloadError(downloadError, unavailable, previewError, showPreview) && (
        <Warning role="alert" className="max-w-[54ch] leading-[1.6]">
          {downloadError}
        </Warning>
      )}
    </div>
  );
};
const message = (reason: unknown) =>
  (reason instanceof Error ? reason.message : 'The browser could not process this image.').replace(
    /^(Thumbnail|Image export) unavailable:\s*/,
    ''
  );
