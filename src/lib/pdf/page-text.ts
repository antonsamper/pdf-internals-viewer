import type { SearchMatch } from '@embedpdf/engine';

import type { ContentToken } from './content-stream';
import type { ByteRange, PdfObjectRecord, PdfValue, StreamResult } from './types';

import { contentInstructions, resolveValue } from './content-stream';
import { MAX_CONTENT_REFERENCES, MAX_TEXT_SOURCES } from './limits';
import { effectiveResources, property } from './navigation';
const hexStringBytes = (text: string, start: number): EncodedByte[] => {
  const digits = [...text.matchAll(/[\da-f]/gi)].map((match) => {
    return {
      at: match.index!,
      value: match[0],
    };
  });
  const bytes: EncodedByte[] = [];

  for (let i = 0; i < digits.length; i += 2) {
    bytes.push({
      end: start + (digits[i + 1]?.at ?? digits[i].at) + 1,
      start: start + digits[i].at,
      value: parseInt(digits[i].value + (digits[i + 1]?.value ?? '0'), 16),
    });
  }

  return bytes;
};

const ESCAPES: Record<string, number> = { b: 8, f: 12, n: 10, r: 13, t: 9 };
const isOctal = (char: string | undefined) => {
  return /[0-7]/.test(char ?? '');
};

const octalEscape = (text: string, first: number) => {
  let last = first;
  let octal = text[first];

  while (octal.length < 3 && isOctal(text[last + 1])) {
    octal += text[++last];
  }

  return { last, value: parseInt(octal, 8) & 255 };
};

/** Reads the escape whose backslash is at `at`: its byte (null for a line continuation) and the last index it uses. */
const literalEscape = (text: string, at: number): { last: number; value: number | null } => {
  const last = at + 1;
  const next = text[last];

  if (next === '\r' || next === '\n') {
    return { last: next === '\r' && text[last + 1] === '\n' ? last + 1 : last, value: null };
  }

  if (isOctal(next)) {
    return octalEscape(text, last);
  }

  return { last, value: ESCAPES[next] ?? next?.charCodeAt(0) ?? 0 };
};

const literalStringBytes = (text: string, start: number): EncodedByte[] => {
  const bytes: EncodedByte[] = [];

  for (let i = 1; i < text.length - 1; i++) {
    const at = i;
    let value = text.charCodeAt(i);

    if (text[i] === '\\') {
      const escape = literalEscape(text, i);

      i = escape.last;
      if (escape.value === null) {
        continue;
      }

      value = escape.value;
    }

    bytes.push({ end: start + i + 1, start: start + at, value });
  }

  return bytes;
};

/** Decode PDF string syntax while retaining the syntax range for every encoded byte. */
export const stringBytes = (text: string, start = 0): EncodedByte[] => {
  if (text[0] === '<') {
    return hexStringBytes(text, start);
  }

  if (text[0] === '(') {
    return literalStringBytes(text, start);
  }

  return [];
};

const clean = (hex: string) => {
  return hex.replace(/\s/g, '').toUpperCase();
};

const MAX_MAPPINGS = 65536;

type CodeMap = Map<string, string>;
const isCode = (key: string) => {
  return key.length > 0 && key.length % 2 === 0 && key.length <= 8;
};

const isTarget = (target: string) => {
  return target.length > 0 && target.length % 4 === 0 && target.length <= 64;
};

const addMapping = (result: CodeMap, key: string, target: string) => {
  if (!isCode(key) || !isTarget(target)) {
    return false;
  }

  let value = '';

  for (let i = 0; i < target.length; i += 4) {
    value += String.fromCharCode(parseInt(target.slice(i, i + 4), 16));
  }

  if (result.has(key) && result.get(key) !== value) {
    return false;
  }

  result.set(key, value);

  return result.size <= MAX_MAPPINGS;
};

/** The target hex for each code in a bfrange row; undefined when the destination is malformed. */
const rangeTargets = (row: RegExpMatchArray, count: number): ((index: number) => string | undefined) | undefined => {
  if (row[5] !== undefined) {
    const array = [...row[5].matchAll(/<([\da-f\s]+)>/gi)];

    if (array.length !== count || row[5].replace(/<([\da-f\s]+)>/gi, '').trim()) {
      return undefined;
    }

    return (index) => {
      return clean(array[index][1]);
    };
  }

  const base = clean(row[4]);

  if (!isTarget(base)) {
    return undefined;
  }

  return (index) => {
    const target = (BigInt(`0x${base}`) + BigInt(index)).toString(16).toUpperCase().padStart(base.length, '0');

    return target.length === base.length ? target : undefined;
  };
};

const addRange = (result: CodeMap, row: RegExpMatchArray) => {
  const first = clean(row[1]);
  const last = clean(row[2]);

  if (!isCode(first) || first.length !== last.length) {
    return false;
  }

  const start = parseInt(first, 16);
  const count = parseInt(last, 16) - start + 1;

  if (count <= 0 || count > MAX_MAPPINGS || result.size + count > MAX_MAPPINGS) {
    return false;
  }

  const targets = rangeTargets(row, count);

  if (!targets) {
    return false;
  }

  for (let i = 0; i < count; i++) {
    const key = (start + i).toString(16).toUpperCase().padStart(first.length, '0');
    const target = targets(i);

    if (target === undefined || !addMapping(result, key, target)) {
      return false;
    }
  }

  return true;
};

const addBlock = (result: CodeMap, block: RegExpMatchArray) => {
  const chars = block[2] === 'bfchar';
  const pattern = chars ? /<([\da-f\s]+)>\s*<([\da-f\s]+)>/gi : /<([\da-f\s]+)>\s*<([\da-f\s]+)>\s*(<([\da-f\s]+)>|\[([\s\S]*?)\])/gi;
  const rows = [...block[3].matchAll(pattern)];

  if (rows.length !== Number(block[1]) || block[3].replace(pattern, '').trim()) {
    return false;
  }

  return rows.every((row) => {
    return chars ? addMapping(result, clean(row[1]), clean(row[2])) : addRange(result, row);
  });
};

/** True when every code has one width that matches the declared code space ranges. */
const hasOneCodeWidth = (text: string, result: CodeMap) => {
  const widths = new Set(
    [...result.keys()].map((key) => {
      return key.length;
    })
  );

  if (widths.size !== 1) {
    return false;
  }

  const width = [...widths][0];

  // Never guess a shorter code or reinterpret part of an unknown multibyte glyph.
  for (const block of text.matchAll(/\d+\s+begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    for (const pair of block[1].matchAll(/<([\da-f\s]+)>\s*<([\da-f\s]+)>/gi)) {
      if (clean(pair[1]).length !== width || clean(pair[2]).length !== width) {
        return false;
      }
    }
  }

  return true;
};

/** Bounded fixed-width ToUnicode maps. Inherited/variable-width maps remain unsupported. */
export const unicodeMap = (source: string): Map<string, string> | undefined => {
  const text = source.replace(/%[^\r\n]*/g, '');

  if (/usecmap/.test(text)) {
    return undefined;
  }

  const blocks = [...text.matchAll(/(\d+)\s+begin(bfchar|bfrange)([\s\S]*?)end\2/g)];

  if (!blocks.length || blocks.length !== (text.match(/\bbegin(?:bfchar|bfrange)\b/g) ?? []).length) {
    return undefined;
  }

  const result: CodeMap = new Map();

  if (
    !blocks.every((block) => {
      return addBlock(result, block);
    })
  ) {
    return undefined;
  }

  return hasOneCodeWidth(text, result) ? result : undefined;
};

const mapDecoder = (map: CodeMap): Decoder => {
  const width = [...map.keys()][0].length / 2;

  return (bytes) => {
    let text = '';
    const ranges: ByteRange[] = [];

    if (bytes.length % width) {
      return { ranges: [bytes[0]], text: '\ufffd' };
    }

    for (let i = 0; i < bytes.length; i += width) {
      const key = bytes
        .slice(i, i + width)
        .map((byte) => {
          return byte.value.toString(16).padStart(2, '0');
        })
        .join('')
        .toUpperCase();
      const value = map.get(key) ?? '\ufffd';
      const range = { end: bytes[i + width - 1].end, start: bytes[i].start };

      text += value;
      for (let j = 0; j < value.length; j++) {
        ranges.push(range);
      }
    }

    return { ranges, text };
  };
};

const BASE_FONTS = [
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
];
const SIMPLE_ENCODINGS = ['WinAnsiEncoding', 'MacRomanEncoding', 'StandardEncoding'];
const isName = (value: PdfValue | undefined, names: string[]) => {
  return value?.type === 'name' && names.includes(value.value);
};

const latinCharacter = (value: number, standardEncoding: boolean) => {
  // StandardEncoding's quote glyphs differ even within the ASCII code range.
  if (standardEncoding && value === 39) {
    return '’';
  }

  if (standardEncoding && value === 96) {
    return '‘';
  }

  return value >= 32 && value <= 126 ? String.fromCharCode(value) : '\ufffd';
};

/** Simple Type1 and TrueType fonts with a standard encoding, or a base font with none. */
const simpleFontDecoder = (font: PdfValue): Decoder | undefined => {
  const subtype = property(font, 'Subtype');
  const encoding = property(font, 'Encoding');

  if (property(font, 'ToUnicode') || !isName(subtype, ['Type1', 'TrueType'])) {
    return undefined;
  }

  if (encoding ? !isName(encoding, SIMPLE_ENCODINGS) : !isName(property(font, 'BaseFont'), BASE_FONTS)) {
    return undefined;
  }

  const standardEncoding = encoding ? isName(encoding, ['StandardEncoding']) : isName(subtype, ['Type1']);

  return (bytes) => {
    return {
      ranges: bytes.map(({ start, end }) => {
        return { end, start };
      }),
      text: bytes
        .map((byte) => {
          return latinCharacter(byte.value, standardEncoding);
        })
        .join(''),
    };
  };
};

const decoder = (font: PdfValue | undefined, map?: CodeMap): Decoder | undefined => {
  if (map) {
    return mapDecoder(map);
  }

  return font ? simpleFontDecoder(font) : undefined;
};

export const mergeRanges = (ranges: ByteRange[]): ByteRange[] => {
  const merged: ByteRange[] = [];

  for (const range of ranges) {
    if (range.end <= range.start) {
      continue;
    }

    const last = merged.at(-1);

    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
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
    for (let j = 0; j < char.length; j++) {
      positions.push(ranges[i]);
    }
  }

  return { positions, value };
};

const MAX_SOURCE_MATCHES = 500;
/** Text decoded since the last text-breaking operator, with the source range of every character. */
const textRun = (term: string) => {
  const needle = term.toLowerCase();
  const matches: ByteRange[][] = [];
  let run = '';
  let positions: ByteRange[] = [];

  return {
    append: (text: string, ranges: ByteRange[]) => {
      run += text;
      for (const range of ranges) {
        positions.push(range);
      }
    },
    flush: () => {
      const { value, positions: foldedPositions } = folded(run, positions);

      run = '';
      positions = [];
      if (!needle) {
        return;
      }

      for (
        let at = value.indexOf(needle);
        at >= 0 && matches.length < MAX_SOURCE_MATCHES;
        at = value.indexOf(needle, at + Math.max(1, needle.length))
      ) {
        matches.push(mergeRanges(foldedPositions.slice(at, at + needle.length)));
      }
    },
    matches,
  };
};

type TextRun = ReturnType<typeof textRun>;
const TEXT_SHOWING = ['Tj', 'TJ', "'", '"'];
const TEXT_BREAKING = ['BT', 'ET', 'Td', 'TD', 'Tm', 'T*', 'Do', 'BI'];
/** The tokens a text-showing operator draws. TJ arrays reuse the PDF lexer for their string and numeric members. */
const shownParts = (operator: string, token: ContentToken): ContentToken[] => {
  return operator === 'TJ'
    ? contentInstructions(token.text.slice(1, -1))
        .instructions.flatMap((row) => {
          return row.tokens;
        })
        .map((part) => {
          return { ...part, start: part.start + token.start + 1 };
        })
    : [token];
};

const appendShown = (run: TextRun, current: Decoder, parts: ContentToken[]) => {
  for (const part of parts) {
    if (part.text[0] === '(' || part.text[0] === '<') {
      const decoded = current(stringBytes(part.text, part.start));

      run.append(decoded.text, decoded.ranges);
    } else if (part.kind === 'number' && Number(part.text) <= -180) {
      // The inferred space has no text-string byte of its own.
      run.append(' ', [{ end: part.start, start: part.start }]);
    }
  }
};

const showText = (run: TextRun, current: Decoder | undefined, operator: string, tokens: ContentToken[]) => {
  if (operator === "'" || operator === '"') {
    run.flush();
  }

  const token = tokens[operator === '"' ? 2 : 0];

  if (!token || !current) {
    run.flush();
  } else {
    appendShown(run, current, shownParts(operator, token));
  }
};

export const sourceTextMatches = (text: string, fonts: Map<string, Decoder | undefined>, term: string): ByteRange[][] => {
  const parsed = contentInstructions(text);
  const run = textRun(term);
  let current: Decoder | undefined;
  const stack: (Decoder | undefined)[] = [];

  for (const { operator, tokens } of parsed.instructions) {
    if (operator === 'q') {
      stack.push(current);
    } else if (operator === 'Q') {
      run.flush();
      current = stack.pop();
    } else if (operator === 'Tf') {
      current = fonts.get(tokens[0]?.text);
    } else if (operator && TEXT_SHOWING.includes(operator)) {
      showText(run, current, operator, tokens);
    } else if (operator && TEXT_BREAKING.includes(operator)) {
      run.flush();
    }
  }

  run.flush();

  return run.matches;
};

/** A page's content streams in order; `complete` is false when /Contents has more than MAX_CONTENT_REFERENCES references. */
export const pageContentIds = (page: PdfObjectRecord, objects: Map<string, PdfObjectRecord>): { ids: string[]; complete: boolean } => {
  const ids: string[] = [];
  const seen = new Set<string>();
  let complete = true;
  const collect = (value: PdfValue | undefined, depth = 0): void => {
    if (!value || depth > 32 || !complete) {
      return;
    }

    if (value.type === 'reference') {
      visit(value.ref, depth);
    } else if (value.type === 'array') {
      value.items.forEach((item) => {
        return collect(item, depth + 1);
      });
    }
  };

  const visit = (ref: string, depth: number) => {
    if (seen.has(ref)) {
      return;
    }

    if (seen.size >= MAX_CONTENT_REFERENCES) {
      complete = false;

      return;
    }

    seen.add(ref);
    const object = objects.get(ref);

    if (object?.stream) {
      ids.push(object.id);
    } else {
      collect(object?.value, depth + 1);
    }
  };

  collect(property(page.value, 'Contents'));

  return { complete, ids };
};

type ReadDecoded = (id: string, mode: 'decoded') => Promise<StreamResult>;
const toUnicodeMap = async (font: PdfValue | undefined, readStream: ReadDecoded) => {
  const unicode = font && property(font, 'ToUnicode');

  if (unicode?.type !== 'reference') {
    return undefined;
  }

  try {
    const stream = await readStream(unicode.ref, 'decoded');

    return !stream.error && !stream.truncated ? unicodeMap(stream.text) : undefined;
  } catch {
    return undefined;
  }
};

/** A decoder for each page font resource name; null when the search was cancelled. */
const pageFonts = async (
  page: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>,
  readStream: ReadDecoded,
  cancelled: () => boolean
): Promise<Map<string, Decoder | undefined> | null> => {
  const resources = resolveValue(effectiveResources(page, objects)?.value, objects);
  const fontDict = resolveValue(resources && property(resources, 'Font'), objects);
  const fonts = new Map<string, Decoder | undefined>();

  if (fontDict?.type !== 'dictionary' && fontDict?.type !== 'stream') {
    return fonts;
  }

  for (const entry of fontDict.entries) {
    if (cancelled()) {
      return null;
    }

    const font = resolveValue(entry.value, objects);

    fonts.set(`/${entry.key}`, decoder(font, await toUnicodeMap(font, readStream)));
  }

  return fonts;
};

interface StreamSearch {
  encrypted: boolean;
  fonts: Map<string, Decoder | undefined>;
  objects: Map<string, PdfObjectRecord>;
  readStream: ReadDecoded;
  term: string;
}
const shiftRanges = (ranges: ByteRange[], offset: number) => {
  return ranges.map((range) => {
    return {
      end: offset + range.end,
      start: offset + range.start,
    };
  });
};

/** Matches in one content stream, at most `limit`, or the stream itself as a candidate when nothing maps. */
const streamSources = async (id: string, search: StreamSearch, limit: number): Promise<TextSource[]> => {
  const object = search.objects.get(id)!;

  try {
    const stream = await search.readStream(id, 'decoded');
    const matches = stream.error ? [] : sourceTextMatches(stream.text, search.fonts, search.term);

    // Retain candidate streams even when font decoding / text reconstruction is unsupported.
    if (!matches.length) {
      return [{ bytes: stream.bytes, id, incomplete: Boolean(stream.error || stream.truncated), ranges: [] }];
    }

    const original = !search.encrypted && !object.stream!.filters.length ? object.stream?.range : undefined;
    const incomplete = stream.truncated || contentInstructions(stream.text).incomplete;

    return matches.slice(0, limit).map((ranges) => {
      return {
        bytes: stream.bytes,
        id,
        incomplete,
        originalRanges: original ? shiftRanges(ranges, original.start) : undefined,
        ranges,
      };
    });
  } catch {
    return [{ bytes: new Uint8Array(), id, incomplete: true, ranges: [] }];
  }
};

/** A page's text sources, at most MAX_TEXT_SOURCES of them. */
export interface PageTextSourceList {
  sources: TextSource[];
  /** True when the page reached the limit, so later matches or content streams were not read. */
  limited: boolean;
  /** True when /Contents had more than MAX_CONTENT_REFERENCES references, so streams after them were not read. */
  contentsLimited: boolean;
}
export const pageTextSourceList = async (
  page: PdfObjectRecord,
  objects: Map<string, PdfObjectRecord>,
  term: string,
  readStream: ReadDecoded,
  encrypted: boolean,
  cancelled: () => boolean
): Promise<PageTextSourceList> => {
  const fonts = await pageFonts(page, objects, readStream, cancelled);

  if (!fonts) {
    return { contentsLimited: false, limited: false, sources: [] };
  }

  const search: StreamSearch = { encrypted, fonts, objects, readStream, term };
  const sources: TextSource[] = [];
  const { complete, ids: contentIds } = pageContentIds(page, objects);
  let read = 0;

  for (const id of contentIds) {
    if (cancelled()) {
      return { contentsLimited: false, limited: false, sources: [] };
    }

    if (sources.length >= MAX_TEXT_SOURCES) {
      break;
    }

    // One more than fits shows whether this stream had matches past the limit.
    sources.push(...(await streamSources(id, search, MAX_TEXT_SOURCES + 1 - sources.length)));
    read++;
  }

  const limited = sources.length > MAX_TEXT_SOURCES || read < contentIds.length;

  return { contentsLimited: !complete && !limited, limited, sources: sources.slice(0, MAX_TEXT_SOURCES) };
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
  /** True when the source list stopped at MAX_TEXT_SOURCES. */
  sourcesLimited: boolean;
  /** True when streams after the first MAX_CONTENT_REFERENCES /Contents references were not read. */
  contentsLimited: boolean;
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
