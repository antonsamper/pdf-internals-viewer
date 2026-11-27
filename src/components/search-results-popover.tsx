import type { CSSProperties, ReactNode, RefObject } from 'react';

import { Popover } from '@base-ui/react/popover';
import { useLayoutEffect, useState } from 'react';

import { cn } from '@/lib/utils';
const isSearchControl = (target: EventTarget | null, anchor: RefObject<HTMLFormElement | null>) => {
  return (
    (target instanceof Node && anchor.current?.contains(target)) ||
    (target instanceof Element && target.closest('[data-search-scope-popup]'))
  );
};
type OpenChangeDetails = Parameters<NonNullable<Popover.Root.Props['onOpenChange']>>[1];
/**
 * True when an outside press or focus-out lands on the search form or scope menu. During focusout, activeElement
 * can still be body. Check the destination too, so moving from results into the external form/menu keeps results open.
 */
const movesWithinSearch = (details: OpenChangeDetails, anchor: RefObject<HTMLFormElement | null>) => {
  if (details.reason !== 'outside-press' && details.reason !== 'focus-out') {
    return false;
  }
  if (isSearchControl(details.event.target, anchor)) {
    return true;
  }
  return (
    details.reason === 'focus-out' &&
    Boolean(
      isSearchControl(document.activeElement, anchor) ||
      (details.event instanceof FocusEvent && isSearchControl(details.event.relatedTarget, anchor))
    )
  );
};
/** Non-modal search: inspecting the document remains possible behind the results. */
export const SearchResultsPopover = ({
  open,
  busy,
  id,
  onOpenChange,
  anchor,
  input,
  children,
}: {
  open: boolean;
  busy: boolean;
  id: string;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLFormElement | null>;
  input: RefObject<HTMLInputElement | null>;
  children: ReactNode;
}) => {
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(180);
  useLayoutEffect(() => {
    if (!open || busy) {
      return;
    }
    const section = popup?.querySelector<HTMLElement>('[data-search-results]');
    if (!section) {
      return;
    }
    const observer = new ResizeObserver(() => {
      return setHeight(section.getBoundingClientRect().height);
    });
    observer.observe(section);
    return () => {
      return observer.disconnect();
    };
  }, [open, busy, popup]);
  return (
    <Popover.Root
      open={open}
      modal={false}
      onOpenChange={(next, details) => {
        if (!next && movesWithinSearch(details, anchor)) {
          details.cancel();
          return;
        }
        onOpenChange(next);
        if (!next && details.reason === 'escape-key') {
          input.current?.focus();
        }
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          positionMethod="fixed"
          className="z-50"
        >
          <Popover.Popup
            id={id}
            ref={setPopup}
            style={{ '--search-loading-height': `${height}px` } as CSSProperties}
            initialFocus={false}
            finalFocus={false}
            className={cn(
              'w-[min(560px,calc(100vw-24px))] overflow-hidden',
              'bg-background',
              'rounded-lg border shadow-popover outline-none'
            )}
            aria-label="Document search"
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
