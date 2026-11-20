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

it('shares immutable scalar leaves across cloned batches without sharing dictionary ownership', async () => {
  const document = await new PdfInspector().open(compressedPdf().bytes);
  const template = document.objects[0];
  document.objects = Array.from({ length: 300 }, (_, i) => ({
    ...template, id: `${i + 1} 0`, objectNumber: i + 1, references: ['999 0'], referencedBy: [],
    value: { type: 'dictionary' as const, text: '<< /Type /Example /Items [ 999 0 R ] >>', entries: [
      { key: 'Type', value: { type: 'name' as const, value: 'Example', text: '/Example' } },
      { key: 'Items', value: { type: 'array' as const, text: '[ 999 0 R ]', items: [
        { type: 'reference' as const, ref: '999 0', text: '999 0 R' },
      ] } },
    ] },
  }));
  const transfer = new DocumentTransfer(document);
  const receiver = new DocumentReceiver();
  let done = false;
  while (!done) {
    const batch = structuredClone(transfer.next());
    receiver.accept(batch.items);
    done = batch.done;
  }
  const result = receiver.finish();
  expect(result.objects).toEqual(document.objects);
  const first = result.objects[0].value;
  const last = result.objects[299].value;
  if (first.type !== 'dictionary' || last.type !== 'dictionary') throw new Error('Expected dictionaries');
  expect(first).not.toBe(last);
  expect(first.entries).not.toBe(last.entries);
  expect(first.entries[0].value).toBe(last.entries[0].value);
  expect(Object.isFrozen(first.entries[0].value)).toBe(true);
  const firstArray = first.entries[1].value;
  const lastArray = last.entries[1].value;
  if (firstArray.type !== 'array' || lastArray.type !== 'array') throw new Error('Expected arrays');
  expect(firstArray).not.toBe(lastArray);
  expect(firstArray.items[0]).toBe(lastArray.items[0]);
});

it('preserves scalar semantics when display text collides, including special numbers and extended fields', async () => {
  const document = await new PdfInspector().open(compressedPdf().bytes);
  const values = [
    { type: 'number' as const, value: -0, text: '0' },
    { type: 'number' as const, value: 0, text: '0' },
    { type: 'number' as const, value: NaN, text: 'NaN' },
    { type: 'number' as const, value: NaN, text: 'NaN' },
    { type: 'number' as const, value: Infinity, text: 'Infinity' },
    { type: 'number' as const, value: -Infinity, text: 'Infinity' },
    { type: 'string' as const, value: 'prefix A', text: '(prefix)' },
    { type: 'string' as const, value: 'prefix B', text: '(prefix)' },
    { type: 'name' as const, value: 'Name', text: '/Name' },
    { type: 'raw' as const, value: '/Name', text: '/Name' },
    { type: 'reference' as const, ref: '1 0', text: 'same display' },
    { type: 'reference' as const, ref: '2 0', text: 'same display' },
    { type: 'name' as const, value: 'Name', text: '/Name', future: 'preserved' },
  ];
  const receiver = new DocumentReceiver();
  receiver.accept([{ type: 'document', document }]);
  const records = values.map((value, i) => ({ ...document.objects[0], id: `${i} 0`, value }));
  for (const object of records) receiver.accept(structuredClone([{ type: 'object', object }]));
  const result = receiver.finish().objects;
  expect(result).toEqual(records);
  for (const [a, b] of [[0, 1], [4, 5], [6, 7], [8, 9], [10, 11], [8, 12]]) expect(result[a].value).not.toBe(result[b].value);
  expect(result[2].value).toBe(result[3].value);
  const other = new DocumentReceiver();
  other.accept([{ type: 'document', document }]);
  other.accept(structuredClone([{ type: 'object', object: records[8] }]));
  expect(other.finish().objects[0].value).not.toBe(result[8].value);
});
