import { useRef, useState } from 'react';

import type { TextSource } from '@/lib/pdf/page-text';

/** Which page-text source (if any) the byte pane highlights, and when to re-reveal it. */
export const useSourceReveal = () => {
  const [textSource, setTextSource] = useState<TextSource | null>(null);
  const [byteReveal, setByteReveal] = useState<number>();
  const sequence = useRef(0);
  return {
    byteReveal,
    clear: () => {
      setByteReveal(undefined);
      setTextSource(null);
    },
    reveal: () => setByteReveal(++sequence.current),
    setByteReveal,
    setTextSource,
    textSource,
  };
};
