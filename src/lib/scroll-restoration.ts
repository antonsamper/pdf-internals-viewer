import type { UIEvent } from 'react';

import { useLayoutEffect, useRef } from 'react';
export const useScrollRestoration = function useScrollRestoration(positionRef: ScrollPosition, ready = true) {
  const onScroll = function onScroll(event: UIEvent<HTMLDivElement>) {
    if (!ready || restored.current?.positionRef !== positionRef) return;
    positionRef.current = {
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop,
    };
  };
  const ref = useRef<HTMLDivElement>(null);
  const restored = useRef<{
    positionRef: ScrollPosition;
    element: HTMLDivElement;
  } | null>(null);
  // Check after every commit: stream contents may arrive after the tab mounts.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !ready || !element.clientHeight) return;
    if (restored.current?.positionRef === positionRef && restored.current.element === element) return;
    element.scrollTop = positionRef.current?.top ?? 0;
    element.scrollLeft = positionRef.current?.left ?? 0;
    restored.current = { element, positionRef };
  });
  return { onScroll, ref };
};
// Mutable visit-local storage: scrolling does not rerender the application and
// these positions never become part of persisted bookmarks.
export type ScrollPosition = {
  current?: {
    top: number;
    left: number;
    /** Hex view only: preserve the byte anchor when the grid changes columns. */
    byteColumns?: number;
  };
};
