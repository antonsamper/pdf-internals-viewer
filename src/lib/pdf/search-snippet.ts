const visibleByte = (byte: number) => {
  return byte >= 32 && byte !== 127 && (byte <= 126 || byte >= 160) ? String.fromCharCode(byte) : '·';
};
const hexByte = (byte: number) => {
  return byte.toString(16).toUpperCase().padStart(2, '0');
};
const snippetText = (data: Uint8Array, hex: boolean) => {
  return hex ? Array.from(data, hexByte).join(' ') : Array.from(data, visibleByte).join('');
};
/** Bounded previews retain the actual matching bytes; control bytes remain visible. */
export const byteSearchSnippet = function byteSearchSnippet(bytes: Uint8Array, start: number, end: number, hex = false): SearchSnippet {
  const context = hex ? 6 : 32;
  const limit = hex ? 24 : 96;
  const text = (data: Uint8Array) => {
    return snippetText(data, hex);
  };
  const gap = (show: boolean | number) => {
    return hex && show ? ' ' : '';
  };
  return {
    after: `${gap(end < bytes.length)}${text(bytes.subarray(end, end + context))}${end + context < bytes.length ? '…' : ''}`,
    before: `${start > context ? '…' : ''}${text(bytes.subarray(Math.max(0, start - context), start))}${gap(start)}`,
    match: `${text(bytes.subarray(start, Math.min(end, start + limit)))}${end - start > limit ? '…' : ''}`,
  };
};
export interface SearchSnippet {
  before: string;
  match: string;
  after: string;
}
