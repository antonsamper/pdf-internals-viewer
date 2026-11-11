import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowDownToLine, Check, Copy, FileCode2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './hex-view.css'

interface HexViewProps {
  bytes: Uint8Array
  range?: { start: number; end: number }
  onByteSelect?: (offset: number) => void
}

const ROW_HEIGHT = 26
const OVERSCAN = 6
const COPY_LIMIT = 64 * 1024

function printable(byte: number) {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
}

export function HexView({ bytes, range, onByteSelect }: HexViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 600, height: 500, top: 0 })
  const [decimal, setDecimal] = useState(false)
  const [jump, setJump] = useState('')
  const [message, setMessage] = useState('')
  const [copying, setCopying] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const columns = viewport.width >= 650 ? 16 : 8
  const totalRows = Math.ceil(bytes.length / columns)
  const firstRow = Math.max(0, Math.floor(viewport.top / ROW_HEIGHT) - OVERSCAN)
  const lastRow = Math.min(totalRows, firstRow + Math.ceil(viewport.height / ROW_HEIGHT) + OVERSCAN * 2)
  const selectionStart = Math.max(0, Math.min(bytes.length, range?.start ?? cursor ?? 0))
  const selectionEnd = Math.max(selectionStart, Math.min(bytes.length, range?.end ?? (cursor === null ? 0 : cursor + 1)))
  const selectedLength = selectionEnd - selectionStart
  const offsetText = (offset: number) => decimal ? offset.toString().padStart(8, '0') : offset.toString(16).toUpperCase().padStart(8, '0')

  useEffect(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setViewport(current => ({ ...current, width: entry.contentRect.width, height: entry.contentRect.height }))
    })
    observer.observe(viewportElement)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return
    const start = Math.max(0, Math.min(bytes.length - 1, range?.start ?? 0))
    viewportElement.scrollTop = Math.floor(start / columns) * ROW_HEIGHT
    const frame = requestAnimationFrame(() => {
      setCursor(null)
      setMessage('')
      setCopying(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [range?.start, range?.end, columns, bytes])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  function jumpToOffset(event: FormEvent) {
    event.preventDefault()
    const input = jump.trim()
    if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(input)) {
      setMessage('Enter a decimal offset, or prefix hexadecimal with 0x.')
      return
    }
    const offset = Number(input)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= bytes.length) {
      setMessage(`Offset must be between 0 and ${Math.max(0, bytes.length - 1).toLocaleString()}.`)
      return
    }
    setCursor(offset)
    setMessage(`Jumped to ${decimal ? offset : `0x${offset.toString(16).toUpperCase()}`}.`)
    if (viewportRef.current) {
      viewportRef.current.scrollTop = Math.floor(offset / columns) * ROW_HEIGHT
      viewportRef.current.focus()
    }
  }

  function selectByte(offset: number) {
    setCursor(offset)
    onByteSelect?.(offset)
  }

  function moveCursor(event: KeyboardEvent<HTMLDivElement>) {
    const current = Math.max(0, Math.min(bytes.length - 1, cursor ?? range?.start ?? 0))
    let next = current
    switch (event.key) {
      case 'ArrowLeft': next--; break
      case 'ArrowRight': next++; break
      case 'ArrowUp': next -= columns; break
      case 'ArrowDown': next += columns; break
      case 'Home': next = event.ctrlKey || event.metaKey ? 0 : Math.floor(current / columns) * columns; break
      case 'End': next = event.ctrlKey || event.metaKey ? bytes.length - 1 : Math.min(bytes.length - 1, Math.floor(current / columns) * columns + columns - 1); break
      case 'Enter':
      case ' ': onByteSelect?.(current); event.preventDefault(); return
      default: return
    }
    if (!bytes.length) return
    event.preventDefault()
    next = Math.max(0, Math.min(bytes.length - 1, next))
    setCursor(next)
    const element = viewportRef.current
    if (!element) return
    const top = Math.floor(next / columns) * ROW_HEIGHT
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = top + ROW_HEIGHT - element.clientHeight
  }

  async function copySelection() {
    if (!selectedLength) return
    if (selectedLength > COPY_LIMIT) {
      setMessage('Selection exceeds the 64 KiB copy limit. Choose a smaller object or byte range.')
      return
    }
    try {
      const value = Array.from(bytes.subarray(selectionStart, selectionEnd), byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
      await navigator.clipboard.writeText(value)
      setCopying(true)
      setMessage(`Copied ${selectedLength.toLocaleString()} bytes as hexadecimal.`)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopying(false), 1800)
    } catch {
      setMessage('Clipboard unavailable. Check browser clipboard permissions and try again.')
    }
  }

  return (
    <section className="hex-view" aria-label="Original file bytes">
      <div className="hex-toolbar">
        <div className="hex-title"><FileCode2 aria-hidden="true" size={15} /><span>Original file</span></div>
        <div className="hex-actions">
          <Button size="xs" variant="ghost" onClick={() => setDecimal(!decimal)} aria-label={`Offsets in ${decimal ? 'decimal' : 'hexadecimal'}; switch to ${decimal ? 'hexadecimal' : 'decimal'}`} title="Change offset display">{decimal ? 'DEC' : 'HEX'}</Button>
          <Button size="icon-xs" variant="ghost" onClick={copySelection} disabled={!selectedLength} aria-label="Copy selected bytes as hexadecimal" title="Copy selected bytes (up to 64 KiB)">{copying ? <Check /> : <Copy />}</Button>
        </div>
      </div>
      <form className="hex-jump" onSubmit={jumpToOffset}>
        <label htmlFor="hex-offset">Go to offset</label>
        <input id="hex-offset" value={jump} onChange={event => setJump(event.target.value)} placeholder="Decimal or 0x…" autoComplete="off" spellCheck={false} disabled={!bytes.length} aria-describedby="hex-jump-help" />
        <Button size="icon-xs" variant="ghost" type="submit" disabled={!bytes.length} aria-label="Jump to offset"><ArrowDownToLine /></Button>
        <span id="hex-jump-help" className="hex-sr-only">Enter a decimal offset or hexadecimal prefixed with 0x.</span>
      </form>
      <div className="hex-column-head" style={{ '--hex-columns': columns } as CSSProperties} aria-hidden="true">
        <span>OFFSET</span><span className="hex-byte-heading">{Array.from({ length: columns }, (_, i) => <span key={i}>{i.toString(16).toUpperCase().padStart(2, '0')}</span>)}</span><span>ASCII</span>
      </div>
      <div ref={viewportRef} className="hex-viewport" tabIndex={0} role="region" aria-label="Hexadecimal bytes. Use arrow keys to move; Enter to inspect the object containing the byte." onScroll={event => {
        const top = event.currentTarget.scrollTop
        setViewport(current => ({ ...current, top }))
      }} onKeyDown={moveCursor}>
        {bytes.length ? <div className="hex-spacer" style={{ height: totalRows * ROW_HEIGHT, '--hex-columns': columns } as CSSProperties}>
          {Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, index) => {
            const row = firstRow + index
            const offset = row * columns
            return <div className="hex-row" key={offset} style={{ top: row * ROW_HEIGHT, height: ROW_HEIGHT }}>
              <span className="hex-offset">{offsetText(offset)}</span>
              <span className="hex-byte-cells">
                {Array.from({ length: columns }, (_, column) => {
                  const position = offset + column
                  const byte = bytes[position]
                  if (position >= bytes.length) return <span className="hex-byte" key={position} />
                  const selected = position >= selectionStart && position < selectionEnd
                  return <button key={position} tabIndex={-1} type="button" className={`hex-byte${selected ? ' hex-selected' : ''}${position === cursor ? ' hex-cursor' : ''}${byte === 0 ? ' hex-zero' : ''}`} onClick={() => selectByte(position)} aria-label={`Offset ${position}, byte ${byte.toString(16).toUpperCase().padStart(2, '0')}`} title={`${position} / 0x${position.toString(16).toUpperCase()}`}>{byte.toString(16).toUpperCase().padStart(2, '0')}</button>
                })}
              </span>
              <span className="hex-ascii" aria-hidden="true">{Array.from(bytes.subarray(offset, offset + columns), (byte, column) => <span key={offset + column} className={offset + column >= selectionStart && offset + column < selectionEnd ? 'hex-selected' : ''}>{printable(byte)}</span>)}</span>
            </div>
          })}
        </div> : <div className="hex-empty"><FileCode2 size={24} aria-hidden="true" /><p>Open a PDF to inspect its bytes.</p></div>}
      </div>
      <div className="hex-status" aria-live="polite">
        {message || (selectedLength ? `${selectedLength.toLocaleString()} bytes selected · ${decimal ? selectionStart : `0x${selectionStart.toString(16).toUpperCase()}`}–${decimal ? selectionEnd - 1 : `0x${(selectionEnd - 1).toString(16).toUpperCase()}`}` : `${bytes.length.toLocaleString()} bytes · offsets are zero-based`)}
      </div>
    </section>
  )
}
