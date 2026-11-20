import type { SearchMatch } from '@embedpdf/engine';

import type { ByteRange, PdfObjectRecord, PdfValue, StreamResult } from './types';

import { contentInstructions, resolveValue } from './content-stream';
import { effectiveResources, property } from './navigation';
/** Decode PDF string syntax while retaining the syntax range for every encoded byte. */
export const stringBytes = (text: string, start = 0): EncodedByte[] => {
  const bytes: EncodedByte[] = [];
  if (text[0] === '<') {
    const digits = [...text.matchAll(/[\da-f]/gi)].map((match) => ({
      at: match.index!,
      value: match[0],
    }));
    for (let i = 0; i < digits.length; i += 2) {
      bytes.push({
        end: start + (digits[i + 1]?.at ?? digits[i].at) + 1,
        start: start + digits[i].at,
        value: parseInt(digits[i].value + (digits[i + 1]?.value ?? '0'), 16),
      });
    }
  } else if (text[0] === '(') {
    for (let i = 1; i < text.length - 1; i++) {
      const at = i;
      let value = text.charCodeAt(i);
      if (text[i] === '\\') {
        const next = text[++i];
        if (next === '\r' || next === '\n') {
          if (next === '\r' && text[i + 1] === '\n') i++;
          continue;
        }
        if (/[0-7]/.test(next ?? '')) {
          let octal = next;
          while (octal.length < 3 && /[0-7]/.test(text[i + 1] ?? '')) octal += text[++i];
          value = parseInt(octal, 8) & 255;
        } else value = ({ b: 8, f: 12, n: 10, r: 13, t: 9 } as Record<string, number>)[next] ?? next?.charCodeAt(0) ?? 0;
      }
      bytes.push({ end: start + i + 1, start: start + at, value });
    }
  }
  return bytes;
};
const clean = (hex: string) => hex.replace(/\s/g, '').toUpperCase();
/** Bounded fixed-width ToUnicode maps. Inherited/variable-width maps remain unsupported. */
export const unicodeMap = (text: string): Map<string, string> | undefined => {
  const add = (key: string, target: string) => {
    if (!key.length || key.length % 2 || key.length > 8 || !target.length || target.length % 4 || target.length > 64) return false;
    let value = '';
    for (let i = 0; i < target.length; i += 4) value += String.fromCharCode(parseInt(target.slice(i, i + 4), 16));
    if (result.has(key) && result.get(key) !== value) return false;
    result.set(key, value);
    return result.size <= 65536;
  };
  text = text.replace(/%[^\r\n]*/g, '');
  if (/usecmap/.test(text)) return undefined;
  const result = new Map<string, string>();
  const blocks = [...text.matchAll(/(\d+)\s+begin(bfchar|bfrange)([\s\S]*?)end\2/g)];
  if (!blocks.length || blocks.length !== (text.match(/\bbegin(?:bfchar|bfrange)\b/g) ?? []).length) return undefined;
  for (const block of blocks) {
    const pattern =
      block[2] === 'bfchar' ? /<([\da-f\s]+)>\s*<([\da-f\s]+)>/gi : /<([\da-f\s]+)>\s*<([\da-f\s]+)>\s*(<([\da-f\s]+)>|\[([\s\S]*?)\])/gi;
    const rows = [...block[3].matchAll(pattern)];
    if (rows.length !== Number(block[1]) || block[3].replace(pattern, '').trim()) return undefined;
    for (const row of rows) {
      const first = clean(row[1]);
      if (block[2] === 'bfchar') {
        if (!add(first, clean(row[2]))) return undefined;
        continue;
      }
      const last = clean(row[2]);
      if (!first.length || first.length % 2 || first.length > 8 || first.length !== last.length) return undefined;
      const start = parseInt(first, 16),
        end = parseInt(last, 16);
      const count = end - start + 1;
      if (count <= 0 || count > 65536 || result.size + count > 65536) return undefined;
      const array = row[5] !== undefined ? [...row[5].matchAll(/<([\da-f\s]+)>/gi)] : undefined;
      if (array && (array.length !== count || row[5].replace(/<([\da-f\s]+)>/gi, '').trim())) return undefined;
      const base = array ? '' : clean(row[4]);
      if (!array && (!base.length || base.length % 4 || base.length > 64)) return undefined;
      for (let i = 0; i < count; i++) {
        const key = (start + i).toString(16).toUpperCase().padStart(first.length, '0');
        const target = array ? clean(array[i][1]) : (BigInt(`0x${base}`) + BigInt(i)).toString(16).toUpperCase().padStart(base.length, '0');
        if ((!array && target.length !== base.length) || !add(key, target)) return undefined;
      }
    }
  }
  const widths = new Set([...result.keys()].map((key) => key.length));
  if (widths.size !== 1) return undefined;
  const width = [...widths][0];
  // Never guess a shorter code or reinterpret part of an unknown multibyte glyph.
  for (const block of text.matchAll(/\d+\s+begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    for (const pair of block[1].matchAll(/<([\da-f\s]+)>\s*<([\da-f\s]+)>/gi)) {
      if (clean(pair[1]).length !== width || clean(pair[2]).length !== width) return undefined;
    }
  }
  return result;
};
const decoder = (font: PdfValue | undefined, map?: Map<string, string>): Decoder | undefined => {
  if (map) {
    const width = [...map.keys()][0].length / 2;
    return (bytes) => {
      let text = '';
      const ranges: ByteRange[] = [];
      if (bytes.length % width) return { ranges: [bytes[0]], text: '\ufffd' };
      for (let i = 0; i < bytes.length; i += width) {
        const key = bytes
          .slice(i, i + width)
          .map((byte) => byte.value.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
        const value = map.get(key) ?? '\ufffd';
        const range = { end: bytes[i + width - 1].end, start: bytes[i].start };
        text += value;
        for (let j = 0; j < value.length; j++) ranges.push(range);
      }
      return { ranges, text };
    };
  }
  if (!font || property(font, 'ToUnicode')) return undefined;
  const subtype = property(font, 'Subtype');
  const base = property(font, 'BaseFont');
  const encoding = property(font, 'Encoding');
  const basicFont =
    base?.type === 'name' &&
    [
      'Helvetica',
      'Helvetica-Bold',
      'Helvetica-Oblique',
      'Helvetica-BoldOblique',
      'Times-Roman',
      'Times-Bold',
      'Times-Italic',
      'Times-BoldItalic',
      'Courier',
      'Courier-Bold',
      'Courier-Oblique',
      'Courier-BoldOblique',
    ].includes(base.value);
  const simpleEncoding = encoding?.type === 'name' && ['WinAnsiEncoding', 'MacRomanEncoding', 'StandardEncoding'].includes(encoding.value);
  if (subtype?.type !== 'name' || !['Type1', 'TrueType'].includes(subtype.value) || !(simpleEncoding || (!encoding && basicFont)))
    return undefined;
  const standardEncoding = encoding?.type === 'name' ? encoding.value === 'StandardEncoding' : !encoding && subtype.value === 'Type1';
  return (bytes) => ({
    // StandardEncoding's quote glyphs differ even within the ASCII code range.
    ranges: bytes.map(({ start, end }) => ({ end, start })),
    text: bytes
      .map((byte) => {
        if (standardEncoding && byte.value === 39) return '’';
        if (standardEncoding && byte.value === 96) return '‘';
        return byte.value >= 32 && byte.value <= 126 ? String.fromCharCode(byte.value) : '\ufffd';
      })
      .join(''),
  });
};
export const mergeRanges = (ranges: ByteRange[]): ByteRange[] => {
  const merged: ByteRange[] = [];
  for (const range of ranges) {
    if (range.end <= range.start) continue;
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
};
/** Keep offsets stable under case folding (including Unicode characters that expand). */
const folded = (text: string, ranges: ByteRange[]) => {
  let value = '';
  const positions: ByteRange[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toLowerCase();
    value += char;
    for (let j = 0; j < char.length; j++) positions.push(ranges[i]);
  }
  return { positions, value };
};
export const sourceTextMatches = (text: string, fonts: Map<string, Decoder | undefined>, term: string): ByteRange[][] => {
  const flush = () => {
    const { value, positions: foldedPositions } = folded(run, positions);
    const needle = term.toLowerCase();
    if (!needle) {
      run = '';
      positions = [];
      return;
    }
    for (let at = value.indexOf(needle); at >= 0 && matches.length < 500; at = value.indexOf(needle, at + Math.max(1, needle.length))) {
      matches.push(mergeRanges(foldedPositions.slice(at, at + needle.length)));
    }
    run = '';
    positions = [];
  };
  const parsed = contentInstructions(text);
  const matches: ByteRange[][] = [];
  let current: Decoder | undefined;
  const stack: (Decoder | undefined)[] = [];
  let run = '';
  let positions: ByteRange[] = [];
  for (const instruction of parsed.instructions) {
    const { operator, tokens } = instruction;
    if (operator === 'q') stack.push(current);
    else if (operator === 'Q') {
      flush();
      current = stack.pop();
    } else if (operator === 'Tf') current = fonts.get(tokens[0]?.text);
    else if (operator && ['Tj', 'TJ', "'", '"'].includes(operator)) {
      if (operator === "'" || operator === '"') flush();
      const token = tokens[operator === '"' ? 2 : 0];
      if (!token || !current) {
        flush();
        continue;
      }
      // Reuse the PDF lexer to parse TJ's string and numeric array members.
      const parts =
        operator === 'TJ'
          ? contentInstructions(token.text.slice(1, -1))
              .instructions.flatMap((row) => row.tokens)
              .map((part) => ({ ...part, start: part.start + token.start + 1 }))
          : [token];
      for (const part of parts) {
        if (part.text[0] === '(' || part.text[0] === '<') {
          const decoded = current(stringBytes(part.text, part.start));
          run += decoded.text;
          for (const range of decoded.ranges) positions.push(range);
        } else if (part.kind === 'number' && Number(part.text) <= -180) {
          run += ' ';
          positions.push({
            // The inferred space has no text-string byte of its own.
            end: part.start,
            start: part.start,
          });
        }
      }
    } else if (operator && ['BT', 'ET', 'Td', 'TD', 'Tm', 'T*', 'Do', 'BI'].includes(operator)) flush();
  }
  flush();
  return matches;
};
export const pageContentIds = (page: PdfObjectRecord, objects: Map<string, PdfObjectRecord>): string[] => {
  const collect = (value: PdfValue | undefined, depth = 0) => {
    if (!value || depth > 32 || seen.size >= 500) return;
    if (value.type === 'reference') {
      if (seen.has(value.ref)) return;
      seen.add(value.ref);
      const object = objects.get(value.ref);
      if (object?.stream) ids.push(object.id);
      else collect(object?.value, depth + 1);
    } else if (value.type === 'array') value.items.forEach((item) => collect(item, depth + 1));
  };
  const ids: string[] = [];
  const seen = new Set<string>();
  collect(property(page.value, 'Contents'));
  return ids;
};
export const pageTextSources = async (
  page: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>,
  term: string,
  readStream: (id: string, mode: 'decoded') => Promise<StreamResult>,
  encrypted: boolean,
  cancelled: () => boolean
): Promise<TextSource[]> => {
  const resources = resolveValue(effectiveResources(page, objects)?.value, objects);
  const fontDict = resolveValue(resources && property(resources, 'Font'), objects);
  const fonts = new Map<string, Decoder | undefined>();
  if (fontDict?.type === 'dictionary' || fontDict?.type === 'stream') {
    for (const entry of fontDict.entries) {
      if (cancelled()) return [];
      const font = resolveValue(entry.value, objects);
      const unicode = font && property(font, 'ToUnicode');
      let map: Map<string, string> | undefined;
      if (unicode?.type === 'reference') {
        try {
          const stream = await readStream(unicode.ref, 'decoded');
          if (!stream.error && !stream.truncated) map = unicodeMap(stream.text);
        } catch {}
      }
      fonts.set(`/${entry.key}`, decoder(font, map));
    }
  }
  const sources: TextSource[] = [];
  const contentIds = pageContentIds(page, objects);
  for (const id of contentIds.slice(0, 100)) {
    if (cancelled()) return [];
    const object = objects.get(id)!;
    try {
      const stream = await readStream(id, 'decoded');
      const matches = stream.error ? [] : sourceTextMatches(stream.text, fonts, term);
      const original = !encrypted && !object.stream!.filters.length ? object.stream?.range : undefined;
      for (const ranges of matches.slice(0, 100 - sources.length)) {
        sources.push({
          bytes: stream.bytes,
          id,
          incomplete: stream.truncated || contentInstructions(stream.text).incomplete,
          originalRanges: original
            ? ranges.map((range) => ({
                end: original.start + range.end,
                start: original.start + range.start,
              }))
            : undefined,
          ranges,
        });
      }
      // Retain candidate streams even when font decoding / text reconstruction is unsupported.
      if (!matches.length)
        sources.push({
          bytes: stream.bytes,
          id,
          incomplete: Boolean(stream.error || stream.truncated),
          ranges: [],
        });
    } catch {
      sources.push({
        bytes: new Uint8Array(),
        id,
        incomplete: true,
        ranges: [],
      });
    }
    if (sources.length >= 100) {
      sources[sources.length - 1].incomplete = true;
      break;
    }
  }
  if (contentIds.length > 100 && sources.length) sources[sources.length - 1].incomplete = true;
  return sources;
};
export interface TextSource {
  id: string;
  bytes: Uint8Array;
  /** Exact syntax bytes that encode the matching text, excluding kerning/operators. */
  ranges: ByteRange[];
  originalRanges?: ByteRange[];
  incomplete: boolean;
}
export interface PageTextLocation {
  pageId: string;
  pageNumber: number;
  count: number;
  snippet: string;
  sources: TextSource[];
  matches: SearchMatch[];
}
type EncodedByte = {
  value: number;
  start: number;
  end: number;
};
type Decoder = (bytes: EncodedByte[]) => {
  text: string;
  ranges: ByteRange[];
};
