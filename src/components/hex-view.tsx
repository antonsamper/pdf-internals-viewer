import type { ComponentProps, CSSProperties, FormEvent, KeyboardEvent, ReactNode } from 'react';

import { ArrowDownToLine, Check, Copy, FileCode2 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import type { ScrollPosition } from '@/lib/scroll-restoration';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The offset, bytes and ASCII columns, shared by the column heading and every row. Below 401px the columns tighten. */
const HexGrid = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn(
      'grid grid-cols-[67px_calc(var(--hex-columns)*23px)_calc(var(--hex-columns)*8px)] items-center gap-x-3.25',
      'px-3.5 whitespace-nowrap',
      'max-w400:grid-cols-[59px_calc(var(--hex-columns)*22px)_calc(var(--hex-columns)*7px)] max-w400:gap-1.75 max-w400:px-2.25',
      className
    )}
    {...props}
  />
);

/** The byte columns in the heading and in each row. */
const ByteColumns = ({ children }: { children: ReactNode }) => (
  <span className={cn('grid grid-cols-[repeat(var(--hex-columns),23px)]', 'max-w400:grid-cols-[repeat(var(--hex-columns),22px)]')}>
    {children}
  </span>
);

// A row renders a button and an ASCII cell per byte, so these two class lists stay module constants: they are merged once, not once per cell.
const HEX_BYTE = cn(
  'rounded-xs border-0 bg-transparent py-0.75 text-center text-foreground',
  'hover:bg-accent hover:text-accent-foreground hover:shadow-[inset_0_0_0_1px_var(--border)]',
  'data-[cursor]:outline-1 data-[cursor]:-outline-offset-1 data-[cursor]:outline-ring',
  'data-[cursor]:focus-visible:outline-2 data-[cursor]:focus-visible:outline-offset-2',
  'data-[zero]:text-muted-foreground',
  // A selected 00 byte keeps the selection colour, as it sorts after the zero rule.
  'data-[selected]:bg-byte-selection data-[selected]:text-byte-selection-foreground',
  'data-[selected]:data-[zero]:text-byte-selection-foreground'
);
const HEX_ASCII_CELL = cn(
  'inline-block w-2 py-0.75 text-center',
  'max-w400:w-[7px]',
  'data-[selected]:bg-byte-selection data-[selected]:text-byte-selection-foreground'
);
const printable = (byte: number) => {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
};
const rowStart = (current: number, columns: number) => Math.floor(current / columns) * columns;
type CursorMove = (current: number, columns: number, length: number, modified: boolean) => number | 'select';
const CURSOR_MOVES = new Map<string, CursorMove>([
  ['ArrowLeft', (current) => current - 1],
  ['ArrowRight', (current) => current + 1],
  ['ArrowUp', (current, columns) => current - columns],
  ['ArrowDown', (current, columns) => current + columns],
  ['Home', (current, columns, _length, modified) => (modified ? 0 : rowStart(current, columns))],
  ['End', (current, columns, length, modified) => (modified ? length - 1 : Math.min(length - 1, rowStart(current, columns) + columns - 1))],
  ['Enter', () => 'select'],
  [' ', () => 'select'],
]);
const cursorMove = (event: KeyboardEvent<HTMLDivElement>, current: number, columns: number, length: number): number | 'select' | null =>
  CURSOR_MOVES.get(event.key)?.(current, columns, length, event.ctrlKey || event.metaKey) ?? null;
/** The selected span: the given range, or the byte under the cursor. */
const selectionBounds = (length: number, range: HexViewProps['range'], cursor: number | null) => {
  const start = Math.max(0, Math.min(length, range?.start ?? cursor ?? 0));
  const end = Math.max(start, Math.min(length, range?.end ?? (cursor === null ? 0 : cursor + 1)));
  return { end, start };
};
/** Whether a byte click selected the object around it, so the view keeps its place instead of jumping to the object's start. */
const keepsLocalSelection = (
  local: { bytes: Uint8Array; offset: number } | null,
  bytes: Uint8Array,
  range: { start?: number; end?: number }
) =>
  local?.bytes === bytes && range.start !== undefined && range.end !== undefined && local.offset >= range.start && local.offset < range.end;
type SavedScroll = NonNullable<ScrollPosition['current']>;
/** Whether the saved scroll position was taken with a different number of byte columns. */
const reflows = (saved: SavedScroll | undefined, columns: number): saved is SavedScroll & { byteColumns: number } =>
  saved?.byteColumns !== undefined && saved.byteColumns !== columns;
/** Where to scroll after the range or the column count changes. */
const nextScrollTop = (
  saved: SavedScroll | undefined,
  columns: number,
  reveal: boolean,
  length: number,
  rangeStart: number | undefined
) => {
  const start = Math.max(0, Math.min(length - 1, rangeStart ?? 0));
  const rangeTop = Math.floor(start / columns) * ROW_HEIGHT;
  if (reveal) return rangeTop;
  // Pixel positions refer to different bytes in the 8- and 16-column grids.
  // Reflow around the previously visible byte, aligned to a complete row.
  if (reflows(saved, columns)) return Math.floor(((saved.top / ROW_HEIGHT) * saved.byteColumns) / columns) * ROW_HEIGHT;
  return saved?.top ?? rangeTop;
};
const storeScroll = (position: ScrollPosition, columns: number, element: HTMLElement) => {
  position.current = {
    byteColumns: columns,
    left: element.scrollLeft,
    top: element.scrollTop,
  };
};
const HexToolbar = ({
  canCopy,
  copying,
  decimal,
  onCopy,
  onToggleDecimal,
  title,
}: {
  canCopy: boolean;
  copying: boolean;
  decimal: boolean;
  onCopy: () => void;
  onToggleDecimal: () => void;
  title: string;
}) => (
  <div className="flex h-10.5 min-h-10.5 shrink-0 items-center justify-between gap-2 border-b px-3.5">
    <div className="flex items-center gap-2 text-small font-semibold">
      <FileCode2 aria-hidden="true" size={15} />
      <span>{title}</span>
    </div>
    <div className="flex items-center gap-0.75">
      <Button
        size="xs"
        variant="ghost"
        onClick={onToggleDecimal}
        aria-label={`Offsets in ${decimal ? 'decimal' : 'hexadecimal'}; switch to ${decimal ? 'hexadecimal' : 'decimal'}`}
        title="Change offset display"
      >
        {decimal ? 'DEC' : 'HEX'}
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onCopy}
        disabled={!canCopy}
        aria-label="Copy selected bytes as hexadecimal"
        title="Copy selected bytes (up to 64 KiB)"
      >
        {copying ? <Check /> : <Copy />}
      </Button>
    </div>
  </div>
);
const HexJumpForm = ({
  disabled,
  id,
  onChange,
  onSubmit,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  value: string;
}) => (
  <form className="flex items-center gap-2 border-b px-3.5 py-2.25 text-detail" onSubmit={onSubmit}>
    <label className="whitespace-nowrap text-muted-foreground" htmlFor={id}>
      Go to offset
    </label>
    <input
      className={cn(
        'w-full min-w-10 px-1.75 py-1 font-mono text-detail',
        'bg-background text-foreground placeholder:text-muted-foreground',
        'rounded-[5px] border border-border',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      )}
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Decimal or 0x…"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      aria-describedby={`${id}-help`}
    />
    <Button size="icon-xs" variant="ghost" type="submit" disabled={disabled} aria-label="Jump to offset">
      <ArrowDownToLine />
    </Button>
    <span id={`${id}-help`} className="sr-only">
      Enter a decimal offset or hexadecimal prefixed with 0x.
    </span>
  </form>
);
const HexRow = ({
  bytes,
  columns,
  cursor,
  isSelected,
  offsetText,
  row,
  onSelect,
}: {
  bytes: Uint8Array;
  columns: number;
  cursor: number | null;
  isSelected: (position: number) => boolean;
  offsetText: (offset: number) => string;
  row: number;
  onSelect: (position: number) => void;
}) => {
  const offset = row * columns;
  return (
    <HexGrid
      className="absolute left-0 font-mono text-detail leading-[normal] tabular-nums hover:bg-muted"
      style={{ height: ROW_HEIGHT, top: row * ROW_HEIGHT }}
    >
      <span className="text-caption leading-[normal] text-muted-foreground select-text">{offsetText(offset)}</span>
      <ByteColumns>
        {Array.from({ length: columns }, (_, column) => {
          const position = offset + column;
          const byte = bytes[position];
          if (position >= bytes.length) return <span key={position} />;
          const selected = isSelected(position);
          return (
            <button
              key={position}
              tabIndex={-1}
              type="button"
              className={HEX_BYTE}
              data-cursor={position === cursor ? '' : undefined}
              data-hex-byte=""
              data-selected={selected ? '' : undefined}
              data-zero={byte === 0 ? '' : undefined}
              onClick={() => onSelect(position)}
              aria-label={`Offset ${position}, byte ${byte.toString(16).toUpperCase().padStart(2, '0')}`}
              title={`${position} / 0x${position.toString(16).toUpperCase()}`}
            >
              {byte.toString(16).toUpperCase().padStart(2, '0')}
            </button>
          );
        })}
      </ByteColumns>
      <span className="flex text-muted-foreground" aria-hidden="true">
        {Array.from(bytes.subarray(offset, offset + columns), (byte, column) => (
          <span key={offset + column} className={HEX_ASCII_CELL} data-selected={isSelected(offset + column) ? '' : undefined}>
            {printable(byte)}
          </span>
        ))}
      </span>
    </HexGrid>
  );
};
const HexColumnHead = ({ columns }: { columns: number }) => (
  <HexGrid
    className={cn(
      'shrink-0 overflow-hidden bg-muted py-2.25 font-mono text-micro tracking-[0.025em] text-muted-foreground',
      'leading-[normal]'
    )}
    style={{ '--hex-columns': columns } as CSSProperties}
    aria-hidden="true"
  >
    <span>OFFSET</span>
    <ByteColumns>
      {Array.from({ length: columns }, (_, i) => (
        <span className="text-center" key={i}>
          {i.toString(16).toUpperCase().padStart(2, '0')}
        </span>
      ))}
    </ByteColumns>
    <span>ASCII</span>
  </HexGrid>
);
const HexStatus = ({
  decimal,
  message,
  ranges,
  selectedLength,
  selectionEnd,
  selectionStart,
  totalBytes,
}: {
  decimal: boolean;
  message: string;
  ranges: HexViewProps['ranges'];
  selectedLength: number;
  selectionEnd: number;
  selectionStart: number;
  totalBytes: number;
}) => (
  <div
    className={cn('min-h-8.5 px-3.5 py-2.25', 'text-caption [overflow-wrap:anywhere] text-muted-foreground', 'border-t', 'leading-[1.5]')}
    data-hex-status=""
    aria-live="polite"
  >
    {message ||
      (ranges && ranges.length > 1
        ? `${selectedLength.toLocaleString()} bytes selected in ${ranges.length} ranges`
        : selectedLength
          ? `${selectedLength.toLocaleString()} byte${selectedLength === 1 ? '' : 's'} selected · ${decimal ? selectionStart : `0x${selectionStart.toString(16).toUpperCase()}`}–${decimal ? selectionEnd - 1 : `0x${(selectionEnd - 1).toString(16).toUpperCase()}`}`
          : `${totalBytes.toLocaleString()} bytes · offsets are zero-based`)}
  </div>
);
export const HexView = ({
  bytes,
  className,
  range,
  ranges,
  revealKey,
  label = 'Original file bytes',
  title = 'Original file',
  onByteSelect,
  scrollPositionRef,
}: HexViewProps) => {
  const inputId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ height: 500, top: 0, width: 600 });
  const [decimal, setDecimal] = useState(false);
  const [jump, setJump] = useState('');
  const [message, setMessage] = useState('');
  const [copying, setCopying] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const localSelection = useRef<{
    bytes: Uint8Array;
    offset: number;
  } | null>(null);
  const localSelectionFrame = useRef<number | undefined>(undefined);
  const lastReveal = useRef<number | undefined>(undefined);
  const rangeStart = range?.start;
  const rangeEnd = range?.end;
  const columns = viewport.width >= 650 ? 16 : 8;
  const totalRows = Math.ceil(bytes.length / columns);
  const firstRow = Math.max(0, Math.floor(viewport.top / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(totalRows, firstRow + Math.ceil(viewport.height / ROW_HEIGHT) + OVERSCAN * 2);
  const { end: selectionEnd, start: selectionStart } = selectionBounds(bytes.length, range, cursor);
  const selectedLength = ranges ? ranges.reduce((sum, part) => sum + part.end - part.start, 0) : selectionEnd - selectionStart;
  const isSelected = (position: number) =>
    ranges ? ranges.some((part) => position >= part.start && position < part.end) : position >= selectionStart && position < selectionEnd;
  const offsetText = (offset: number) =>
    decimal ? offset.toString().padStart(8, '0') : offset.toString(16).toUpperCase().padStart(8, '0');
  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport((current) => ({
        ...current,
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      }));
    });
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    const reveal = revealKey !== undefined && revealKey !== lastReveal.current;
    lastReveal.current = revealKey;
    const saved = scrollPositionRef.current;
    // A byte click may select its enclosing object, whose start can be far
    // above the viewport. Preserve the clicked byte's position and cursor.
    if (!reveal && !reflows(saved, columns) && keepsLocalSelection(localSelection.current, bytes, { end: rangeEnd, start: rangeStart })) {
      localSelection.current = null;
      storeScroll(scrollPositionRef, columns, viewportElement);
      setMessage('');
      setCopying(false);
      return;
    }
    if (reveal) {
      localSelection.current = null;
    }
    viewportElement.scrollTop = nextScrollTop(saved, columns, reveal, bytes.length, rangeStart);
    viewportElement.scrollLeft = saved?.left ?? 0;
    // Store synchronously too: Strict Mode may repeat this layout effect
    // before the browser emits a scroll event for the explicit reveal.
    storeScroll(scrollPositionRef, columns, viewportElement);
    setViewport((current) => ({ ...current, top: viewportElement.scrollTop }));
    const frame = requestAnimationFrame(() => {
      setCursor(null);
      setMessage('');
      setCopying(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [rangeStart, rangeEnd, columns, bytes, scrollPositionRef, revealKey]);
  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
      if (localSelectionFrame.current !== undefined) cancelAnimationFrame(localSelectionFrame.current);
    },
    []
  );

  const jumpToOffset = (event: FormEvent) => {
    event.preventDefault();
    const input = jump.trim();
    if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(input)) {
      setMessage('Enter a decimal offset, or prefix hexadecimal with 0x.');
      return;
    }
    const offset = Number(input);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= bytes.length) {
      setMessage(`Offset must be between 0 and ${Math.max(0, bytes.length - 1).toLocaleString()}.`);
      return;
    }
    setCursor(offset);
    setMessage(`Jumped to ${decimal ? offset : `0x${offset.toString(16).toUpperCase()}`}.`);
    if (viewportRef.current) {
      viewportRef.current.scrollTop = Math.floor(offset / columns) * ROW_HEIGHT;
      viewportRef.current.focus();
    }
  };

  const selectByte = (offset: number) => {
    localSelection.current = { bytes, offset };
    if (localSelectionFrame.current !== undefined) cancelAnimationFrame(localSelectionFrame.current);
    // Clear even when the same object's range stays unchanged. Otherwise a
    // later external navigation could incorrectly suppress its own reveal.
    localSelectionFrame.current = requestAnimationFrame(() => {
      localSelection.current = null;
      localSelectionFrame.current = undefined;
    });
    setCursor(offset);
    onByteSelect?.(offset);
  };

  const moveCursor = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = Math.max(0, Math.min(bytes.length - 1, cursor ?? range?.start ?? 0));
    const move = cursorMove(event, current, columns, bytes.length);
    if (move === 'select') {
      selectByte(current);
      event.preventDefault();
      return;
    }
    if (move === null) return;
    let next = move;
    if (!bytes.length) return;
    event.preventDefault();
    next = Math.max(0, Math.min(bytes.length - 1, next));
    setCursor(next);
    const element = viewportRef.current;
    if (!element) return;
    const top = Math.floor(next / columns) * ROW_HEIGHT;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = top + ROW_HEIGHT - element.clientHeight;
  };

  const copySelection = async () => {
    if (!selectedLength) return;
    if (selectedLength > COPY_LIMIT) {
      setMessage('Selection exceeds the 64 KiB copy limit. Choose a smaller object or byte range.');
      return;
    }
    try {
      const value = Array.from(
        ranges
          ? Uint8Array.from(ranges.flatMap((part) => Array.from(bytes.subarray(part.start, part.end))))
          : bytes.subarray(selectionStart, selectionEnd),
        (byte) => byte.toString(16).padStart(2, '0').toUpperCase()
      ).join(' ');
      await navigator.clipboard.writeText(value);
      setCopying(true);
      setMessage(`Copied ${selectedLength.toLocaleString()} bytes as hexadecimal.`);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopying(false), 1800);
    } catch {
      setMessage('Clipboard unavailable. Check browser clipboard permissions and try again.');
    }
  };

  return (
    <section className={cn('flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground', className)} aria-label={label}>
      <HexToolbar
        title={title}
        decimal={decimal}
        copying={copying}
        canCopy={selectedLength > 0}
        onToggleDecimal={() => setDecimal(!decimal)}
        onCopy={copySelection}
      />
      <HexJumpForm id={inputId} value={jump} disabled={!bytes.length} onChange={setJump} onSubmit={jumpToOffset} />
      <HexColumnHead columns={columns} />
      <div
        ref={viewportRef}
        className={cn(
          'relative min-h-37.5 flex-1 overflow-auto',
          '[scrollbar-gutter:stable] -outline-offset-2',
          'focus-visible:outline-2 focus-visible:outline-ring'
        )}
        data-hex-viewport=""
        tabIndex={0}
        role="region"
        aria-label="Hexadecimal bytes. Use arrow keys to move; Enter to inspect the object containing the byte."
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          storeScroll(scrollPositionRef, columns, event.currentTarget);
          setViewport((current) => ({ ...current, top }));
        }}
        onKeyDown={moveCursor}
      >
        {bytes.length ? (
          <div
            className="relative min-w-max"
            data-hex-spacer=""
            style={
              {
                '--hex-columns': columns,
                height: totalRows * ROW_HEIGHT,
              } as CSSProperties
            }
          >
            {Array.from({ length: Math.max(0, lastRow - firstRow) }, (_row, index) => (
              <HexRow
                key={(firstRow + index) * columns}
                bytes={bytes}
                columns={columns}
                cursor={cursor}
                isSelected={isSelected}
                offsetText={offsetText}
                row={firstRow + index}
                onSelect={selectByte}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              'flex h-full min-h-45 flex-col items-center justify-center gap-2.5 p-6.25',
              'text-center text-small text-muted-foreground'
            )}
          >
            <FileCode2 size={24} aria-hidden="true" />
            <p>Open a PDF to inspect its bytes.</p>
          </div>
        )}
      </div>
      <HexStatus
        message={message}
        ranges={ranges}
        selectedLength={selectedLength}
        selectionStart={selectionStart}
        selectionEnd={selectionEnd}
        decimal={decimal}
        totalBytes={bytes.length}
      />
    </section>
  );
};
interface HexViewProps {
  className?: string;
  bytes: Uint8Array;
  scrollPositionRef: ScrollPosition;
  range?: {
    start: number;
    end: number;
  };
  ranges?: {
    start: number;
    end: number;
  }[];
  revealKey?: number;
  label?: string;
  title?: string;
  onByteSelect?: (offset: number) => void;
}
const ROW_HEIGHT = 26;
const OVERSCAN = 6;
const COPY_LIMIT = 64 * 1024;
