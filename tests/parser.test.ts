import { describe, expect, it } from 'vitest';
import { PdfInspector } from '../src/lib/pdf/inspector';
// The fixture generator is deliberately plain Node ESM, shared with sample generation.
// @ts-expect-error local JavaScript fixture helpers have no declaration file
import { minimalPdf, compressedPdf, incrementalPdf, misleadingStreamPdf, resourcesPdf, filteredPdf, encryptedPdf, classicPdf, oversizedDecodedPdf } from '../scripts/fixtures/pdf-fixtures.mjs';

const object = (document: Awaited<ReturnType<PdfInspector['open']>>, id: string) => {
  const value = document.objects.find(item => item.id === id);
  if (!value) throw new Error(`Missing object ${id}`);
  return value;
};
describe('read-only PDF inspection', () => {
  it('maps exact original object boundaries and builds reference links', async () => {
    const fixture = minimalPdf();
    const document = await new PdfInspector().open(fixture.bytes, 'minimal.pdf');
    expect(document.pages).toEqual(['3 0']);
    expect(document.catalogId).toBe('1 0');
    expect(document.xrefFormat).toBe('table');
    expect(document.objects).toHaveLength(5);
    for (const entry of document.objects) expect(entry.provenance).toEqual({ type: 'file', range: fixture.ranges.get(entry.objectNumber) });
    expect(object(document, '4 0').referencedBy).toContain('3 0');
    expect(object(document, '3 0').references).toContain('4 0');
  });
  it('preserves stream boundaries when stream data contains fake object/end markers', async () => {
    const fixture = misleadingStreamPdf();
    const inspector = new PdfInspector();
    const document = await inspector.open(fixture.bytes);
    expect(document.objects).toHaveLength(5);
    expect(object(document, '4 0').provenance).toEqual({ type: 'file', range: fixture.ranges.get(4) });
    expect(inspector.readStream('4 0', 'raw').text).toBe(fixture.data);
  });
  it.each([false, true])('reads compressed objects and correct decoded/container coordinates, hybrid=%s', async hybrid => {
    const fixture = compressedPdf(hybrid);
    const inspector = new PdfInspector();
    const document = await inspector.open(fixture.bytes);
    expect(document.xrefFormat).toBe(hybrid ? 'hybrid' : 'stream');
    expect(document.pages).toEqual(['3 0']);
    expect(document.objects).toHaveLength(7);
    for (const id of [1, 2, 3, 5]) {
      const record = object(document, `${id} 0`);
      expect(record.provenance).toEqual({ type: 'decoded', containerId: '6 0', range: fixture.locations.get(id), containerRange: fixture.ranges.get(6) });
      expect(record.source).toContain('<<');
    }
  });
  it('selects current incremental objects and respects free xref entries', async () => {
    const fixture = incrementalPdf();
    const document = await new PdfInspector().open(fixture.bytes);
    expect(document.objects.some(item => item.id === '6 0')).toBe(false);
    const page = object(document, '3 0');
    expect(page.provenance.type).toBe('file');
    if (page.provenance.type === 'file') expect(page.provenance.range.start).toBe(fixture.updatedOffset);
    expect(page.source).toContain('/Rotate 90');
  });
  it('decodes Flate streams while preserving source bytes and inherited resources', async () => {
    const fixture = resourcesPdf();
    const original = fixture.bytes.slice();
    const inspector = new PdfInspector();
    const document = await inspector.open(fixture.bytes);
    expect(inspector.readStream('4 0', 'decoded').text).toContain('(Resources and references)');
    expect(object(document, '2 0').references).toContain('5 0');
    expect(object(document, '6 0').label).toContain('Image');
    expect(fixture.bytes).toEqual(original);
  });
  it('decodes chained ASCIIHex/Flate filters', async () => {
    const fixture = filteredPdf('asciihex-flate');
    const inspector = new PdfInspector();
    await inspector.open(fixture.bytes);
    expect(inspector.readStream('4 0', 'decoded').text).toBe(fixture.content);
  });
  it('decodes ASCII85', async () => {
    const inspector = new PdfInspector();
    await inspector.open(filteredPdf('ascii85').bytes);
    expect(inspector.readStream('4 0', 'decoded').text).toBe('Hello world!');
  });
  it('applies PNG predictors after Flate decompression', async () => {
    const inspector = new PdfInspector();
    await inspector.open(filteredPdf('predictor').bytes);
    expect(Array.from(inspector.readStream('4 0', 'decoded').bytes)).toEqual([10, 20, 30, 15, 25, 35]);
  });
  it('bounds Flate output before allocating a complete oversized stream', async () => {
    const inspector = new PdfInspector();
    await inspector.open(oversizedDecodedPdf().bytes);
    const result = inspector.readStream('4 0', 'decoded');
    expect(result.error).toContain('32 MiB');
    expect(result.bytes.length).toBe(0);
    expect(inspector.readStream('4 0', 'raw').bytes.length).toBeGreaterThan(0);
  });
  it('reports encrypted PDFs as locked, without returning unreadable semantic objects', async () => {
    const document = await new PdfInspector().open(encryptedPdf().bytes);
    expect(document.locked).toBe(true);
    expect(document.objects).toHaveLength(0);
    expect(document.warnings.join(' ')).toContain('Encrypted');
  });
  it('retains recovered objects and labels invalid xref recovery', async () => {
    const fixture = minimalPdf();
    const bytes = fixture.bytes.slice(0, fixture.xref);
    const document = await new PdfInspector().open(bytes);
    expect(document.recovered).toBe(true);
    expect(document.warnings.join(' ')).toContain('Recovered');
    expect(document.objects).toHaveLength(5);
  });
  it('reports dangling references without recursively following cycles', async () => {
    const fixture = classicPdf([[1, '<< /Type /Catalog /Pages 2 0 R /Missing 99 0 R >>'], [2, '<< /Type /Pages /Kids [] /Count 0 /Cycle 1 0 R >>']]);
    const document = await new PdfInspector().open(fixture.bytes);
    expect(object(document, '1 0').warnings.join(' ')).toContain('99 0 R');
    expect(object(document, '1 0').referencedBy).toContain('2 0');
  });
});
