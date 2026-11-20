import type { TextSource } from '@/lib/pdf/page-text';
import type { ByteRange } from '@/lib/pdf/types';
import type { ScrollPosition } from '@/lib/scroll-restoration';

import { HexView } from '@/components/hex-view';
import { TextSourceBytes } from '@/components/text-source-bytes';

/** Original bytes: the plain hex dump, or the highlighted text source of a search hit. */
export const BytePane = ({
  activeResult,
  bytes,
  range,
  revealKey,
  scrollPositionRef,
  textSource,
  onByteSelect,
}: {
  activeResult: number | null;
  bytes: Uint8Array;
  range: ByteRange | undefined;
  revealKey: number | undefined;
  scrollPositionRef: ScrollPosition;
  textSource: TextSource | null;
  onByteSelect: (offset: number) => void;
}) =>
  textSource ? (
    <TextSourceBytes
      key={`${revealKey}-${activeResult}-${textSource.id}-${textSource.ranges[0]?.start ?? 'candidate'}`}
      source={textSource}
      revealKey={revealKey}
      bytes={bytes}
      originalRange={range}
      scrollPositionRef={scrollPositionRef}
      onByteSelect={onByteSelect}
    />
  ) : (
    <HexView bytes={bytes} revealKey={revealKey} scrollPositionRef={scrollPositionRef} range={range} onByteSelect={onByteSelect} />
  );
