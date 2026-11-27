import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from '../src/lib/pdf/types';

// @ts-expect-error Node ESM fixture generators have no declaration file.
import { oversizedImagePdf, incorrectUnicodePdf, ADDITIONAL_EXAMPLES, attachmentText } from '../scripts/fixtures/example-fixtures.mjs';
import { PdfInspector } from '../src/lib/pdf/inspector';
import { documentIssues } from '../src/lib/pdf/issues';
import { effectiveResources, property } from '../src/lib/pdf/navigation';
import { pageRotationSummary } from '../src/lib/pdf/page-rotation';
import { pageTextSourceList } from '../src/lib/pdf/page-text';
import { resourceCatalog } from '../src/lib/pdf/resource-catalog';

interface ExampleContext {
  bytes: Buffer;
  document: PdfDocumentInfo;
  get: (id: string, key: string) => PdfValue | undefined;
  inspector: PdfInspector;
  objects: Map<string, PdfObjectRecord>;
  resources: ReturnType<typeof resourceCatalog>;
}

it('bundles reproducible samples whose indexed objects support the walkthrough findings', async () => {
  for (const [name, generate] of [
    ['oversized-image', oversizedImagePdf],
    ['incorrect-unicode', incorrectUnicodePdf],
  ] as const) {
    const bytes = readFileSync(`public/samples/${name}.pdf`);
    expect(Buffer.from(generate().bytes)).toEqual(bytes);
    const inspector = new PdfInspector();
    const document = await inspector.open(new Uint8Array(bytes), `${name}.pdf`);
    expect(document.recovered).toBe(false);
    expect(document.pages).toEqual(['3 0']);
    expect(document.objects).toHaveLength(6);
    const evidence = document.objects.find((object) => object.id === '6 0')!;
    if (name === 'oversized-image') {
      expect(evidence.label).toContain('Image');
      expect(evidence.stream?.length).toBe(4_320_000);
      expect(evidence.stream?.filters).toEqual([]);
      expect(4_320_000 / bytes.length).toBeGreaterThan(0.99);
      expect(inspector.readStream('4 0', 'decoded').text).toContain('144 0 0 144 72 464 cm\n/Im1 Do');
    } else {
      expect(document.objects.find((object) => object.id === '5 0')?.references).toContain('6 0');
      expect(inspector.readStream('6 0', 'decoded').text).toContain('<31> <0039>');
      expect(inspector.readStream('4 0', 'decoded').text).toContain('Invoice total: \\2431,250.00');
    }
  }
});

/** Checks that each example PDF contains the evidence its walkthrough points to. */
const exampleChecks: Record<string, (context: ExampleContext) => void | Promise<void>> = {
  'broken-xref': ({ bytes, document, get, inspector, objects }) => {
    expect(document.pages).toEqual(['3 0']);
    expect(objects.has('6 0')).toBe(false);
    expect(get('1 0', 'Metadata')).toMatchObject({ ref: '6 0' });
    const issues = documentIssues(document);
    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(1);
    expect(issues.filter((issue) => issue.severity === 'warning')).toHaveLength(1);
    expect(issues.find((issue) => issue.severity === 'error')?.evidence).toContain('invalid cross-reference offset 999999');
    expect(issues.find((issue) => issue.severity === 'warning')).toMatchObject({
      evidence: 'Dangling or unresolved reference: 6 0 R',
      objectId: '1 0',
    });
    expect(inspector.readStream('4 0', 'decoded').text).toContain('A readable page');
    expect(Buffer.from(bytes).toString('latin1')).toContain('6 0 obj');
    expect(Buffer.from(bytes).toString('latin1')).toContain('0000999999 00000 n');
  },
  'embedded-font': ({ get, inspector, resources }) => {
    expect(get('5 0', 'FontDescriptor')).toBeUndefined();
    expect(get('6 0', 'FontDescriptor')).toMatchObject({ ref: '7 0' });
    expect(get('7 0', 'FontFile2')).toMatchObject({ ref: '8 0' });
    const font = inspector.readStream('8 0', 'decoded', 'download');
    expect(Buffer.from(font.bytes)).toEqual(readFileSync('scripts/fixtures/assets/example-mark.ttf'));
    expect(resources.filter((resource) => resource.kind === 'Font')).toHaveLength(2);
    expect(resources.find((resource) => resource.object.id === '6 0')?.downloads[0]).toMatchObject({ kind: 'font', streamId: '8 0' });
  },
  'find-text-source': async ({ document, inspector, objects }) => {
    expect(document.pages).toEqual(['3 0']);
    expect(objects.get('4 0')?.stream?.filters).toEqual(['FlateDecode']);
    expect(inspector.readStream('4 0', 'decoded').text).toContain('[(Payment refer) 12 (ence: INV-2048)] TJ');
    const { sources } = await pageTextSourceList(
      objects.get('3 0')!,
      objects,
      'reference',
      async (id) => inspector.readStream(id, 'decoded'),
      false,
      () => false
    );
    expect(sources).toHaveLength(1);
    expect(sources[0]!.incomplete).toBe(false);
    expect(sources[0]!.ranges.map((range) => Buffer.from(sources[0]!.bytes.subarray(range.start, range.end)).toString('latin1'))).toEqual([
      'refer',
      'ence',
    ]);
  },
  'hidden-attachment': ({ get, inspector, resources }) => {
    expect(get('6 0', 'F')).toMatchObject({ value: 'line-items.csv' });
    expect(Buffer.from(inspector.readStream('7 0', 'decoded', 'download').bytes).toString('latin1')).toBe(attachmentText);
    expect(resources.filter((resource) => resource.kind === 'Attachment')).toHaveLength(1);
    expect(resources.find((resource) => resource.kind === 'Attachment')?.downloads[0]).toMatchObject({
      filename: 'line-items.csv',
      streamId: '7 0',
    });
    expect(get('3 0', 'Annots')).toBeUndefined();
  },
  'inherited-resources': ({ get, objects, resources }) => {
    expect(get('3 0', 'Resources')).toBeUndefined();
    expect(effectiveResources(objects.get('3 0')!, objects)?.inheritedFrom).toBe('2 0');
    expect(resources.filter((resource) => ['Font', 'Image'].includes(resource.kind))).toHaveLength(2);
  },
  'opening-action': ({ document, get }) => {
    expect(get('1 0', 'OpenAction')).toMatchObject({ ref: '6 0' });
    expect(get('6 0', 'S')).toMatchObject({ value: 'GoTo' });
    expect(get('6 0', 'D')).toMatchObject({
      items: [{ ref: '3 0' }, { value: 'Fit' }],
    });
    expect(document.objects.some((object) => /JavaScript|Launch|https?:/.test(object.source))).toBe(false);
  },
  'page-rotation': ({ document, get, inspector, objects }) => {
    expect(pageRotationSummary(document.pages, objects)).toBe('Mixed (0°, 90°)');
    expect(get('3 0', 'Rotate')).toBeUndefined();
    expect(get('2 0', 'Rotate')).toMatchObject({ value: 90 });
    expect(get('4 0', 'Rotate')).toMatchObject({ value: 0 });
    expect(inspector.readStream('6 0', 'decoded').text).toContain('0 1 -1 0 450 80 cm');
  },
  'repeated-logo': ({ document, get, inspector, resources }) => {
    expect(document.pages).toEqual(['3 0', '4 0', '5 0']);
    const imageRef = (id: string) => property(property(get(id, 'Resources')!, 'XObject')!, 'Logo');
    expect(imageRef('3 0')).toMatchObject({ ref: '7 0' });
    expect(imageRef('4 0')).toMatchObject({ ref: '7 0' });
    expect(imageRef('5 0')).toMatchObject({ ref: '8 0' });
    const first = inspector.readStream('7 0', 'raw');
    expect(first.bytes.length).toBe(1728);
    expect(inspector.readStream('8 0', 'raw').bytes).toEqual(first.bytes);
    expect(resources.filter((resource) => resource.kind === 'Image')).toHaveLength(2);
  },
};

for (const [name, generate] of ADDITIONAL_EXAMPLES) {
  it(`provides reproducible, inspectable evidence for ${name}`, async () => {
    const check = exampleChecks[name];
    if (!check) throw new Error(`No checks for the ${name} example`);
    const bytes = readFileSync(`public/samples/${name}.pdf`);
    expect(Buffer.from(generate().bytes)).toEqual(bytes);
    const inspector = new PdfInspector();
    const document = await inspector.open(new Uint8Array(bytes));
    expect(document.recovered).toBe(false);
    const objects = new Map(document.objects.map((object) => [object.id, object]));
    const get = (id: string, key: string) => property(objects.get(id)!.value, key);
    await check({ bytes, document, get, inspector, objects, resources: resourceCatalog(objects) });
  });
}
