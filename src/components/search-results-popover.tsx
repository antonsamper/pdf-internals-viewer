import { Popover } from '@base-ui/react/popover';
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
const isSearchControl = (target: EventTarget | null, anchor: RefObject<HTMLFormElement | null>) =>
  (target instanceof Node && anchor.current?.contains(target)) ||
  (target instanceof Element && target.closest('[data-search-scope-popup]'));
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
    if (!open || busy) return;
    const section = popup?.querySelector<HTMLElement>('[data-search-results]');
    if (!section) return;
    const observer = new ResizeObserver(() => setHeight(section.getBoundingClientRect().height));
    observer.observe(section);
    return () => observer.disconnect();
  }, [open, busy, popup]);
  return (
    <Popover.Root
      open={open}
      modal={false}
      onOpenChange={(next, details) => {
        // During focusout, activeElement can still be body. Check the destination
        // too, so moving from results into the external form/menu keeps results open.
        if (
          !next &&
          (details.reason === 'outside-press' || details.reason === 'focus-out') &&
          (isSearchControl(details.event.target, anchor) ||
            (details.reason === 'focus-out' &&
              (isSearchControl(document.activeElement, anchor) ||
                (details.event instanceof FocusEvent && isSearchControl(details.event.relatedTarget, anchor)))))
        ) {
          details.cancel();
          return;
        }
        onOpenChange(next);
        if (!next && details.reason === 'escape-key') input.current?.focus();
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
            className="w-[min(560px,calc(100vw-24px))] overflow-hidden rounded-lg border bg-background shadow-[0_12px_40px_rgb(25_12_40_/_18%),0_2px_8px_rgb(25_12_40_/_8%)] outline-none"
            aria-label="Document search"
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
