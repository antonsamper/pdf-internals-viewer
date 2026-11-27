import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// @ts-expect-error shared plain JS fixture generator
import { classicPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { PdfInspector } from '../src/lib/pdf/inspector';
import { pageTextSources, stringBytes, unicodeMap, pageContentIds } from '../src/lib/pdf/page-text';
const fixture = (content: string, compressed = false, font = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', cmap?: string) => {
  const data = compressed ? deflateSync(Buffer.from(content, 'latin1')) : Buffer.from(content, 'latin1');
  const stream = Buffer.concat([
    Buffer.from(`<< /Length ${data.length}${compressed ? ' /Filter /FlateDecode' : ''} >>\nstream\n`),
    data,
    Buffer.from('\nendstream'),
  ]);
  return classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'],
    [4, stream],
    [5, font],
    ...(cmap ? [[6, Buffer.from(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`)]] : []),
  ]);
};
const sources = async (content: string, term: string, compressed = false, font?: string, cmap?: string, encrypted = false) => {
  const file = fixture(content, compressed, font, cmap);
  const inspector = new PdfInspector();
  const document = await inspector.open(file.bytes);
  const objects = new Map(document.objects.map((object) => [object.id, object]));
  const results = await pageTextSources(
    objects.get('3 0')!,
    objects,
    term,
    async (id) => inspector.readStream(id, 'decoded'),
    encrypted,
    () => false
  );
  return { bytes: file.bytes, objects, results };
};
const selected = (
  bytes: Uint8Array,
  ranges: {
    start: number;
    end: number;
  }[]
) => ranges.map((range) => Buffer.from(bytes.subarray(range.start, range.end)).toString('latin1'));
describe('page text source mapping', () => {
  for (const encoding of [undefined, 'StandardEncoding', 'WinAnsiEncoding', 'MacRomanEncoding']) {
    it(`respects quote codes in ${encoding ?? 'default Type1 encoding'}`, async () => {
      const standard = !encoding || encoding === 'StandardEncoding';
      const font = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica${encoding ? ` /Encoding /${encoding}` : ''} >>`;
      const content = "BT /F1 12 Tf (`can't) Tj ET";
      const { results } = await sources(content, standard ? '‘can’t' : "`can't", false, font);
      expect(selected(results[0].bytes, results[0].ranges)).toEqual(["`can't"]);
      const wrong = await sources(content, standard ? "`can't" : '‘can’t', false, font);
      expect(wrong.results[0].ranges).toEqual([]);
    });
  }
  it('maps large ligature expansions without exceeding the argument stack', async () => {
    const cmap = `1 beginbfchar <41> <${'0041'.repeat(16)}> endbfchar`;
    const { results } = await sources(
      `BT /F1 12 Tf (${'A'.repeat(10000)}) Tj ET`,
      'AAAA',
      false,
      '<< /Type /Font /Subtype /Type0 /BaseFont /Custom /ToUnicode 6 0 R >>',
      cmap
    );
    expect(results[0].bytes.length).toBeGreaterThan(10000);
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['A']);
  });
  it('maps a case-insensitive split word in a compressed MacRoman subset font', async () => {
    const { results } = await sources(
      'q BT /F1 1 Tf [(Lor) 17 (em) -91 ( ) -35 (ipsum)] TJ ET Q',
      'lorem',
      true,
      '<< /Type /Font /Subtype /TrueType /BaseFont /NPPOAD+HelveticaNeue-Light /Encoding /MacRomanEncoding >>'
    );
    expect(results).toHaveLength(1);
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['Lor', 'em']);
    expect(results[0].originalRanges).toBeUndefined();
    expect(results[0].incomplete).toBe(false);
  });
  it('maps a word split across TJ strings without highlighting kerning, delimiters or operators', async () => {
    const { results, bytes } = await sources('BT /F1 12 Tf [(Hel) -20 (lo)] TJ ET', 'Hello');
    expect(results).toHaveLength(1);
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['Hel', 'lo']);
    expect(selected(bytes, results[0].originalRanges!)).toEqual(['Hel', 'lo']);
  });
  it('finds a phrase with a spacing adjustment without selecting the adjustment bytes', async () => {
    const { results } = await sources('BT /F1 12 Tf [(Hello) -250 (world)] TJ ET', 'Hello world');
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['Hello', 'world']);
  });
  it('joins consecutive text-showing operators and handles octal escapes and hex strings', async () => {
    const { results } = await sources('BT /F1 12 Tf (H\\145l) Tj <6C6F> Tj ET', 'hello');
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['H\\145l', '6C6F']);
  });
  it('provides decoded ranges and only a containing-stream link for compressed or encrypted bytes', async () => {
    for (const [compressed, encrypted] of [
      [true, false],
      [false, true],
    ]) {
      const { results } = await sources('BT /F1 12 Tf (Hello) Tj ET', 'Hello', compressed, undefined, undefined, encrypted);
      expect(results[0].ranges).toHaveLength(1);
      expect(results[0].originalRanges).toBeUndefined();
    }
  });
  it('resolves inherited fonts and maps supported ToUnicode strings, including a ligature', async () => {
    const cmap = '3 beginbfchar\n<0001> <0048>\n<0002> <0069>\n<0003> <00660069>\nendbfchar';
    const { results } = await sources(
      'BT /F1 12 Tf <000100020003> Tj ET',
      'Hifi',
      false,
      '<< /Type /Font /Subtype /Type0 /ToUnicode 6 0 R >>',
      cmap
    );
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['000100020003']);
  });
  it('does not guess at custom encodings or unsupported CMaps', async () => {
    for (const font of ['<< /Subtype /Type1 /BaseFont /Symbol >>', '<< /Subtype /TrueType /Encoding << /Differences [65 /Z] >> >>']) {
      const { results } = await sources('BT /F1 12 Tf (Hello) Tj ET', 'Hello', false, font);
      expect(results[0].ranges).toEqual([]);
      expect(results[0].originalRanges).toBeUndefined();
    }
    expect(unicodeMap('/Parent usecmap 1 beginbfchar <00> <0041> endbfchar')).toBeUndefined();
  });
  it('does not guess code widths or reinterpret partial multibyte character codes', async () => {
    expect(unicodeMap('2 beginbfchar <01> <0041> <0102> <0042> endbfchar')).toBeUndefined();
    const cmap = '1 beginbfchar <0001> <0041> endbfchar';
    const { results } = await sources('BT /F1 12 Tf <FF0001> Tj ET', 'A', false, '<< /Subtype /Type0 /ToUnicode 6 0 R >>', cmap);
    expect(results[0].ranges).toEqual([]);
  });
  it('maps sequential and explicit Unicode ranges, including ligatures and surrogate pairs', async () => {
    const map = unicodeMap(
      '1 beginbfchar <00> <0048> endbfchar 2 beginbfrange <01> <02> <0069> <03> <04> [<00660069> <D83DDE00>] endbfrange'
    )!;
    expect([...map]).toEqual([
      ['00', 'H'],
      ['01', 'i'],
      ['02', 'j'],
      ['03', 'fi'],
      ['04', '😀'],
    ]);
    const { results, bytes } = await sources(
      'BT /F1 12 Tf <000100020003> Tj ET',
      'ABC',
      false,
      '<< /Subtype /Type0 /ToUnicode 6 0 R >>',
      '1 beginbfrange <0001> <0003> <0041> endbfrange'
    );
    expect(selected(results[0].bytes, results[0].ranges)).toEqual(['000100020003']);
    expect(selected(bytes, results[0].originalRanges!)).toEqual(['000100020003']);
  });
  it('rejects malformed, overflowing, oversized and variable-width Unicode ranges', () => {
    for (const cmap of [
      '1 beginbfrange <01> <02> [<0041>] endbfrange',
      '1 beginbfrange <02> <01> <0041> endbfrange',
      '1 beginbfrange <000000> <FFFFFF> <0041> endbfrange',
      '1 beginbfrange <00> <01> <FFFF> endbfrange',
      '2 beginbfchar <01> <0041> endbfchar',
      '1 beginbfrange <00> <01> <0041> unexpected endbfrange',
      '2 begincodespacerange <00> <FF> <0000> <FFFF> endcodespacerange 1 beginbfrange <0000> <0001> <0041> endbfrange',
    ])
      expect(unicodeMap(cmap)).toBeUndefined();
    expect(unicodeMap('1 beginbfrange <00> <01> <00FF> endbfrange')?.get('01')).toBe('Ā');
  });
  it('keeps repeated source occurrences separate and never joins across lines, text objects or unknown fonts', async () => {
    const { results } = await sources('BT /F1 12 Tf (Hello Hello) Tj ET', 'Hello');
    expect(results).toHaveLength(2);
    expect(results[0].ranges[0].start).not.toBe(results[1].ranges[0].start);
    for (const separator of ['0 -12 Td', 'ET BT', '/Unknown 12 Tf (x) Tj /F1 12 Tf']) {
      const { results: joined } = await sources(`BT /F1 12 Tf (Hel) Tj ${separator} (lo) Tj ET`, 'Hello');
      expect(joined[0].ranges).toEqual([]);
    }
  });
  it('stops at inline image data and treats malformed/truncated parsing as incomplete', async () => {
    const { results } = await sources('BT /F1 12 Tf (Hello) Tj ET BI /W 1 /H 1 ID random', 'Hello');
    expect(results[0].ranges).toHaveLength(1);
    expect(results[0].incomplete).toBe(true);
  });
  it('cancels without reading more streams and safely follows indirect Contents arrays with cycles', async () => {
    const { objects } = await sources('BT /F1 12 Tf (Hello) Tj ET', 'Hello');
    const page = objects.get('3 0')!;
    const result = await pageTextSources(
      page,
      objects,
      'Hello',
      () => {
        throw new Error('Must not read');
      },
      false,
      () => true
    );
    expect(result).toEqual([]);
    expect(pageContentIds(page, objects)).toEqual(['4 0']);
  });
  it('decodes escaped parentheses, continued lines and odd hex nibbles with source offsets', () => {
    expect(stringBytes('(a\\(b\\)\\\r\nc)').map((byte) => byte.value)).toEqual([97, 40, 98, 41, 99]);
    expect(stringBytes('<4 1 2>')).toEqual([
      { end: 4, start: 1, value: 65 },
      { end: 6, start: 5, value: 32 },
    ]);
  });
  it('caps a page at 100 text sources and marks only the last one incomplete', async () => {
    const { results } = await sources(`BT /F1 12 Tf (${'Hi '.repeat(130)}) Tj ET`, 'Hi');
    expect(results).toHaveLength(100);
    expect(results.every((result) => result.ranges.length === 1)).toBe(true);
    expect(results.slice(0, -1).some((result) => result.incomplete)).toBe(false);
    expect(results[99].incomplete).toBe(true);
  });
  it('starts a new line for \' and " and maps the string operand of "', async () => {
    const quote = await sources("BT /F1 12 Tf 14 TL (Hel) Tj (lo) ' ET", 'Hello');
    expect(quote.results).toHaveLength(1);
    expect(quote.results[0].ranges).toEqual([]);
    const next = await sources("BT /F1 12 Tf 14 TL (Hel) Tj (lo) ' ET", 'lo');
    expect(selected(next.bytes, next.results[0].originalRanges!)).toEqual(['lo']);
    const spaced = await sources('BT /F1 12 Tf 14 TL (Hel) Tj 1 2 (lo) " ET', 'Hello');
    expect(spaced.results[0].ranges).toEqual([]);
    const { bytes, results } = await sources('BT /F1 12 Tf 14 TL 1 2 (Hello) " ET', 'Hello');
    expect(selected(bytes, results[0].originalRanges!)).toEqual(['Hello']);
  });
});
