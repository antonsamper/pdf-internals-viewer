import { cn } from 'cn';
import { ArrowDownToLine, Check, Copy, FileCode2 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';

import type { ScrollPosition } from '@/lib/scroll-restoration';

import { Button } from '@/components/ui/button';

// Offset, bytes and ASCII columns shared by the column heading and every row. Below 401px the columns tighten.
const HEX_GRID = cn(
  'grid grid-cols-[67px_calc(var(--hex-columns)*23px)_calc(var(--hex-columns)*8px)] items-center gap-x-[13px]',
  'px-3.5 whitespace-nowrap',
  'max-w400:grid-cols-[59px_calc(var(--hex-columns)*22px)_calc(var(--hex-columns)*7px)] max-w400:gap-[7px] max-w400:px-[9px]'
);
const HEX_BYTE_CELLS = 'grid grid-cols-[repeat(var(--hex-columns),23px)] max-w400:grid-cols-[repeat(var(--hex-columns),22px)]';
const HEX_SELECTED = 'data-[selected]:bg-byte-selection data-[selected]:text-byte-selection-foreground';
// Constant class lists are built once: a row renders a button and an ASCII cell per byte.
const HEX_ROW = cn(HEX_GRID, 'absolute left-0 font-mono text-[11px] leading-[normal] tabular-nums hover:bg-muted');
const HEX_BYTE = cn(
  'rounded-[2px] border-0 bg-transparent py-[3px] text-center text-foreground',
  'hover:bg-accent hover:text-accent-foreground hover:shadow-[inset_0_0_0_1px_var(--border)]',
  'data-[cursor]:outline-1 data-[cursor]:-outline-offset-1 data-[cursor]:outline-ring',
  'data-[zero]:text-muted-foreground',
  // A selected 00 byte keeps the selection colour, as it sorts after the zero rule.
  HEX_SELECTED,
  'data-[selected]:data-[zero]:text-byte-selection-foreground'
);
const HEX_ASCII_CELL = cn('inline-block w-2 py-[3px] text-center', 'max-w400:w-[7px]', HEX_SELECTED);
const printable = (byte: number) => {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
};
const cursorMove = (event: KeyboardEvent<HTMLDivElement>, current: number, columns: number, length: number): number | 'select' | null => {
  const modified = event.ctrlKey || event.metaKey;
  const rowStart = Math.floor(current / columns) * columns;
  switch (event.key) {
    case 'ArrowLeft':
      return current - 1;
    case 'ArrowRight':
      return current + 1;
    case 'ArrowUp':
      return current - columns;
    case 'ArrowDown':
      return current + columns;
    case 'Home':
      return modified ? 0 : rowStart;
    case 'End':
      return modified ? length - 1 : Math.min(length - 1, rowStart + columns - 1);
    case 'Enter':
    case ' ':
      return 'select';
    default:
      return null;
  }
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
  <div className="flex h-[42px] min-h-[42px] shrink-0 items-center justify-between gap-2 border-b px-3.5">
    <div className="flex items-center gap-2 text-[12px] font-semibold">
      <FileCode2 aria-hidden="true" size={15} />
      <span>{title}</span>
    </div>
    <div className="flex items-center gap-[3px]">
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
  <form className="flex items-center gap-2 border-b px-3.5 py-[9px] text-[11px]" onSubmit={onSubmit}>
    <label className="whitespace-nowrap text-muted-foreground" htmlFor={id}>
      Go to offset
    </label>
    <input
      className={cn(
        'w-full min-w-10 px-[7px] py-1',
        'bg-background text-foreground placeholder:text-muted-foreground',
        'rounded-[5px] border border-border',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        // The global `input` font rule outranks utilities, so the family and size take `!`.
        'font-mono! text-[11px]!'
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
    <div className={HEX_ROW} style={{ height: ROW_HEIGHT, top: row * ROW_HEIGHT }}>
      <span className="text-[10px] text-muted-foreground select-text">{offsetText(offset)}</span>
      <span className={HEX_BYTE_CELLS}>
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
      </span>
      <span className="flex text-muted-foreground" aria-hidden="true">
        {Array.from(bytes.subarray(offset, offset + columns), (byte, column) => (
          <span key={offset + column} className={HEX_ASCII_CELL} data-selected={isSelected(offset + column) ? '' : undefined}>
            {printable(byte)}
          </span>
        ))}
      </span>
    </div>
  );
};
const HexColumnHead = ({ columns }: { columns: number }) => (
  <div
    className={cn(
      HEX_GRID,
      'shrink-0 overflow-hidden bg-muted py-[9px] font-mono text-[9px] tracking-[0.025em] text-muted-foreground',
      'leading-[normal]'
    )}
    style={{ '--hex-columns': columns } as CSSProperties}
    aria-hidden="true"
  >
    <span>OFFSET</span>
    <span className={HEX_BYTE_CELLS}>
      {Array.from({ length: columns }, (_, i) => (
        <span className="text-center" key={i}>
          {i.toString(16).toUpperCase().padStart(2, '0')}
        </span>
      ))}
    </span>
    <span>ASCII</span>
  </div>
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
    className={cn(
      'min-h-[34px] px-3.5 py-[9px]',
      'text-[10px] [overflow-wrap:anywhere] text-muted-foreground',
      'border-t',
      'leading-[1.5]'
    )}
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
  const selectionStart = Math.max(0, Math.min(bytes.length, range?.start ?? cursor ?? 0));
  const selectionEnd = Math.max(selectionStart, Math.min(bytes.length, range?.end ?? (cursor === null ? 0 : cursor + 1)));
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
    const start = Math.max(0, Math.min(bytes.length - 1, rangeStart ?? 0));
    const reveal = revealKey !== undefined && revealKey !== lastReveal.current;
    lastReveal.current = revealKey;
    const saved = scrollPositionRef.current;
    const reflow = saved?.byteColumns !== undefined && saved.byteColumns !== columns;
    const local = localSelection.current;
    // A byte click may select its enclosing object, whose start can be far
    // above the viewport. Preserve the clicked byte's position and cursor.
    if (
      !reveal &&
      !reflow &&
      local?.bytes === bytes &&
      rangeStart !== undefined &&
      rangeEnd !== undefined &&
      local.offset >= rangeStart &&
      local.offset < rangeEnd
    ) {
      localSelection.current = null;
      scrollPositionRef.current = {
        byteColumns: columns,
        left: viewportElement.scrollLeft,
        top: viewportElement.scrollTop,
      };
      setMessage('');
      setCopying(false);
      return;
    }
    if (reveal) {
      localSelection.current = null;
    }
    // Pixel positions refer to different bytes in the 8- and 16-column grids.
    // Reflow around the previously visible byte, aligned to a complete row.
    const restoredTop = reflow ? Math.floor(((saved.top / ROW_HEIGHT) * saved.byteColumns!) / columns) * ROW_HEIGHT : saved?.top;
    viewportElement.scrollTop = reveal
      ? Math.floor(start / columns) * ROW_HEIGHT
      : (restoredTop ?? Math.floor(start / columns) * ROW_HEIGHT);
    viewportElement.scrollLeft = saved?.left ?? 0;
    // Store synchronously too: Strict Mode may repeat this layout effect
    // before the browser emits a scroll event for the explicit reveal.
    scrollPositionRef.current = {
      byteColumns: columns,
      left: viewportElement.scrollLeft,
      top: viewportElement.scrollTop,
    };
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
          'relative min-h-[150px] flex-1 overflow-auto',
          '[scrollbar-gutter:stable] -outline-offset-2',
          'focus-visible:outline-2 focus-visible:outline-ring'
        )}
        data-hex-viewport=""
        tabIndex={0}
        role="region"
        aria-label="Hexadecimal bytes. Use arrow keys to move; Enter to inspect the object containing the byte."
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          scrollPositionRef.current = {
            byteColumns: columns,
            left: event.currentTarget.scrollLeft,
            top,
          };
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
              'flex h-full min-h-[180px] flex-col items-center justify-center gap-2.5 p-[25px]',
              'text-center text-[12px] text-muted-foreground'
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
