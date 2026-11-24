import { cn } from 'cn';
import { Download, LoaderCircle, ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { PdfObjectRecord, StreamResult } from '@/lib/pdf/types';

import { WARNING_INLINE } from '@/components/inspector-styles';
import { Button } from '@/components/ui/button';
import { fileSize } from '@/lib/file-size';
import { buildImageFile, imageThumbnail, queueImageWork } from '@/lib/image-export';
import { imageDownloadPlan } from '@/lib/pdf/image-download';
import { saveFile } from '@/lib/save-file';
import { useVisible } from '@/lib/use-visible';
/** Notes under an image keep a readable measure. */
const IMAGE_NOTE = 'max-w-[54ch] leading-[1.6]';

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
  let plan: ReturnType<typeof imageDownloadPlan> | undefined;
  let unavailable: string | undefined;
  try {
    plan = imageDownloadPlan(object);
  } catch (reason) {
    unavailable = message(reason);
  }
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
  const showDownloadError = downloadError && downloadError !== unavailable && (!showPreview || downloadError !== previewError);
  return (
    <div ref={ref}>
      {showPreview &&
        (state.image ? (
          <img
            src={state.image}
            alt={`Image object ${object.id}`}
            className="my-3 block size-40 max-w-full rounded-[8px] border bg-background object-contain p-2"
          />
        ) : (
          <div
            className="my-3 flex items-center gap-2.5 rounded-[8px] border border-dashed bg-sidebar p-3.5 text-[11px] text-muted-foreground"
            role="status"
          >
            {previewError ? (
              <>
                <ImageOff aria-hidden="true" className="size-[18px] shrink-0" />
                <p className={IMAGE_NOTE}>Preview unavailable: {previewError}</p>
              </>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="size-[18px] shrink-0 animate-spin motion-reduce:animate-none" />
                <p className={IMAGE_NOTE}>Loading image preview…</p>
              </>
            )}
          </div>
        ))}
      <div
        className="my-2.5 text-[11px] leading-[1.6] text-muted-foreground tabular-nums"
        data-image-file-size
        title={state.size !== undefined ? `${state.size.toLocaleString()} bytes` : undefined}
      >
        {state.size !== undefined
          ? `Download: ${fileSize(state.size)}`
          : unavailable || state.exportError
            ? 'Download size unavailable'
            : 'Calculating download size…'}
        {object.stream && <span> · In PDF: {fileSize(object.stream.length)}</span>}
      </div>
      <Button variant="outline" size="sm" disabled={pending || !plan} onClick={() => void download()}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {pending ? 'Exporting image…' : 'Download image'}
      </Button>
      <p className={cn('mt-2 text-xs text-muted-foreground', IMAGE_NOTE)}>
        {unavailable
          ? `Image export unavailable: ${unavailable}`
          : plan?.format === 'jpeg'
            ? 'JPEG · embedded file, without page masks, colour adjustments, or transforms.'
            : 'PNG · full image dimensions, without page transforms. Up to 4 megapixels / 4096 pixels per side.'}
      </p>
      {showDownloadError && (
        <p role="alert" className={cn(WARNING_INLINE, IMAGE_NOTE)}>
          {downloadError}
        </p>
      )}
    </div>
  );
};
const message = (reason: unknown) =>
  (reason instanceof Error ? reason.message : 'The browser could not process this image.').replace(
    /^(Thumbnail|Image export) unavailable:\s*/,
    ''
  );
