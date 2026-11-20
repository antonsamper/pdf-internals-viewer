export interface SearchSnippet {
  before: string
  match: string
  after: string
}

/** Bounded previews retain the actual matching bytes; control bytes remain visible. */
export function byteSearchSnippet(
  bytes: Uint8Array,
  start: number,
  end: number,
  hex = false
): SearchSnippet {
  const context = hex ? 6 : 32
  const limit = hex ? 24 : 96
  const text = (data: Uint8Array) =>
    hex
      ? Array.from(data, (byte) =>
          byte.toString(16).toUpperCase().padStart(2, "0")
        ).join(" ")
      : Array.from(data, (byte) =>
          byte >= 32 && byte !== 127 && (byte <= 126 || byte >= 160)
            ? String.fromCharCode(byte)
            : "·"
        ).join("")
  return {
    before: `${start > context ? "…" : ""}${text(bytes.subarray(Math.max(0, start - context), start))}${hex && start ? " " : ""}`,
    match: `${text(bytes.subarray(start, Math.min(end, start + limit)))}${end - start > limit ? "…" : ""}`,
    after: `${hex && end < bytes.length ? " " : ""}${text(bytes.subarray(end, end + context))}${end + context < bytes.length ? "…" : ""}`,
  }
}
