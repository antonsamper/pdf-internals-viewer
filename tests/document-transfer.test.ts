import { expect, it } from 'vitest';
import { PdfInspector } from '../src/lib/pdf/inspector';
import { DocumentReceiver, DocumentTransfer, TRANSFER_BATCH_CHARACTERS } from '../src/lib/pdf/document-transfer';
import { embeddedDownloads } from '../src/lib/pdf/downloads';
import { resourceCatalog } from '../src/lib/pdf/resource-catalog';
// @ts-expect-error shared JavaScript fixture generator
import { embeddedFilesPdf, compressedPdf } from '../scripts/fixtures/pdf-fixtures.mjs';

it.each([embeddedFilesPdf, compressedPdf])('preserves complete records, source provenance and shared indexes through independently cloned batches', async (fixture) => {
  const document = await new PdfInspector().open(fixture().bytes);
  const sender = new DocumentTransfer(document);
  const receiver = new DocumentReceiver();
  let done = false;
  while (!done) {
    const batch = structuredClone(sender.next());
    receiver.accept(batch.items);
    done = batch.done;
  }
  const result = receiver.finish();
  const { indexes, ...rest } = result;
  expect(rest).toEqual(document);
  const objects = new Map(result.objects.map(object => [object.id, object]));
  expect(indexes?.downloads).toEqual([...embeddedDownloads(objects)]);
  expect(indexes?.resources).toEqual(resourceCatalog(objects).map(({ object, ...entry }) => ({ ...entry, objectId: object.id })));
});

it('splits large documents without losing object identity, special numbers or Unicode source', async () => {
  const document = await new PdfInspector().open(embeddedFilesPdf().bytes);
  const template = document.objects[0];
  document.objects = Array.from({ length: 900 }, (_, i) => ({
    ...template,
    id: `${i + 1} 0`, objectNumber: i + 1,
    value: { type: 'number' as const, value: i === 0 ? -0 : i === 1 ? Infinity : i, text: String(i) },
    source: '字🙂 é /UnknownKey\n'.repeat(300),
    references: [], referencedBy: [],
  }));
  const sender = new DocumentTransfer(document);
  const receiver = new DocumentReceiver();
  let batches = 0;
  let done = false;
  while (!done) {
    const batch = structuredClone(sender.next());
    expect(batch.items.length).toBeLessThanOrEqual(128);
    expect(JSON.stringify(batch.items).length).toBeLessThanOrEqual(TRANSFER_BATCH_CHARACTERS);
    receiver.accept(batch.items);
    batches++;
    done = batch.done;
  }
  expect(batches).toBeGreaterThan(10);
  expect(receiver.finish().objects).toEqual(document.objects);
});

it('keeps a single oversized record intact and rejects missing metadata', async () => {
  const document = await new PdfInspector().open(embeddedFilesPdf().bytes);
  document.objects[0].source = 'x'.repeat(TRANSFER_BATCH_CHARACTERS * 2);
  const sender = new DocumentTransfer(document);
  const receiver = new DocumentReceiver();
  let done = false;
  let oversized = false;
  while (!done) {
    const batch = sender.next();
    if (JSON.stringify(batch.items).length > TRANSFER_BATCH_CHARACTERS) {
      oversized = true;
      expect(batch.items).toHaveLength(1);
    }
    receiver.accept(structuredClone(batch.items));
    done = batch.done;
  }
  expect(oversized).toBe(true);
  expect(receiver.finish().objects).toEqual(document.objects);
  expect(() => new DocumentReceiver().finish()).toThrow('summary');
});
