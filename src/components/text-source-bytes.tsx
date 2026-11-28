import { useRef, useState } from 'react';

import type { TextSource } from '@/lib/pdf/page-text';
import type { ByteRange } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { HexView } from './hex-view';
import { Button } from './ui/button';
interface SourceView {
  source: TextSource;
  exact: boolean;
  originalRange?: ByteRange;
}
/** What the highlighted bytes in the chosen representation are, and how far they can be trusted. */
const sourceNote = (decoded: boolean, { exact, originalRange, source }: SourceView) => {
  if (decoded) {
    return exact
      ? 'Highlighted bytes encode matching source text. Offsets are within this decoded stream.'
      : 'Candidate page content stream. Exact text bytes could not be mapped.';
  }

  if (source.originalRanges) {
    return 'Highlighted original bytes encode matching source text; intervening operators are excluded.';
  }

  if (exact) {
    return 'Containing stream only. Compressed or encrypted text has no direct word-sized range in the original file.';
  }

  return originalRange
    ? 'The highlighted bytes are a candidate page content stream, not an exact word match. Exact text bytes could not be mapped.'
    : 'Original source bytes are unavailable. Exact text bytes could not be mapped.';
};

/** Switches between the original file bytes and the decoded stream bytes. */
const RepresentationToggle = ({
  decoded,
  canDecode,
  onChange,
}: {
  decoded: boolean;
  canDecode: boolean;
  onChange: (decoded: boolean) => void;
}) => {
  return (
    <div className="flex flex-wrap gap-1.5 border-b px-3 py-2" role="group" aria-label="Text match byte representation">
      <Button
        size="xs"
        variant={decoded ? 'ghost' : 'secondary'}
        aria-pressed={!decoded}
        onClick={() => {
          return onChange(false);
        }}
      >
        Original bytes
      </Button>
      <Button
        size="xs"
        variant={decoded ? 'secondary' : 'ghost'}
        aria-pressed={decoded}
        disabled={!canDecode}
        onClick={() => {
          return onChange(true);
        }}
      >
        Decoded bytes
      </Button>
    </div>
  );
};

export const TextSourceBytes = function TextSourceBytes({
  source,
  revealKey,
  bytes,
  originalRange,
  scrollPositionRef,
  onByteSelect,
}: {
  source: TextSource;
  revealKey?: number;
  bytes: Uint8Array;
  originalRange?: ByteRange;
  scrollPositionRef: ScrollPosition;
  onByteSelect: (offset: number) => void;
}) {
  const exact = source.ranges.length > 0;
  const [decoded, setDecoded] = useState(!source.originalRanges && source.bytes.length > 0 && (exact || !originalRange));
  const decodedScroll = useRef<ScrollPosition['current']>(undefined);

  return (
    <div className="flex h-full min-h-0 flex-col" data-text-source-bytes>
      <RepresentationToggle decoded={decoded} canDecode={source.bytes.length > 0} onChange={setDecoded} />
      <p className="m-0 border-b px-3 py-2 text-detail text-muted-foreground" data-text-source-note role="status">
        {sourceNote(decoded, { exact, originalRange, source })}
        {source.incomplete && ' Stream inspection is incomplete.'}
      </p>
      {decoded ? (
        <HexView
          className="flex-1"
          key={`decoded-${source.id}`}
          revealKey={revealKey}
          bytes={source.bytes}
          range={source.ranges[0]}
          ranges={exact ? source.ranges : undefined}
          scrollPositionRef={decodedScroll}
          label="Decoded stream bytes"
          title={`Decoded · ${source.id} obj`}
        />
      ) : (
        <HexView
          className="flex-1"
          key="original"
          revealKey={revealKey}
          bytes={bytes}
          range={source.originalRanges?.[0] ?? originalRange}
          ranges={source.originalRanges}
          scrollPositionRef={scrollPositionRef}
          onByteSelect={onByteSelect}
        />
      )}
    </div>
  );
};
