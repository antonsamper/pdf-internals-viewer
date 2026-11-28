import type { PdfObject, PdfRef as EngineRef, PdfStream } from '@libpdf/core';
import type { ParsedDocument, XRefEntry } from 'pdf-internals-viewer/inspection';

import { PdfRef, inspectionCompressedLocation, inspectionReadIndirect } from 'pdf-internals-viewer/inspection';

import type { ByteRange, PdfObjectRecord, Provenance } from './types';

import { byteText, errorMessage, isStream, streamFilters } from './engine-objects.ts';
import { MAX_DISPLAY_BYTES } from './limits.ts';
import { valueTree } from './value-tree.ts';

type InUseEntry = Exclude<XRefEntry, { type: 'free' }>;
type UncompressedEntry = Extract<XRefEntry, { type: 'uncompressed' }>;
type CompressedEntry = Extract<XRefEntry, { type: 'compressed' }>;
export type IndexedEntry = [number, InUseEntry];

/** State shared by the steps that index the objects of one opened document. */
export interface ObjectIndex {
  bytes: Uint8Array;
  encryptRef: EngineRef | undefined;
  objects: Map<string, PdfObject>;
  parsed: ParsedDocument;
  rawStreams: Map<string, Uint8Array>;
  streams: Map<string, PdfStream>;
  warnings: string[];
}

interface SourceLocation {
  provenance: Provenance;
  source: string;
}

const isIndexedEntry = (item: [number, XRefEntry]): item is IndexedEntry => {
  return item[0] > 0 && item[1].type !== 'free';
};

/** Returns the in-use cross-reference entries in object-number order. */
export const inUseEntries = (parsed: ParsedDocument): IndexedEntry[] => {
  return Array.from(parsed.xref)
    .filter(isIndexedEntry)
    .toSorted(([a], [b]) => {
      return a - b;
    });
};

const entryGeneration = (entry: XRefEntry | undefined) => {
  return entry?.type === 'uncompressed' ? entry.generation : 0;
};

const entryId = (number: number, entry: XRefEntry | undefined) => {
  return `${number} ${entryGeneration(entry)}`;
};

const isValidOffset = (offset: number, length: number) => {
  return Number.isSafeInteger(offset) && offset > 0 && offset < length;
};

// A malformed in-use xref at offset zero may resolve to the engine's
// synthetic null placeholder. It is not an indexed source object.
const invalidOffsetWarning = (entry: InUseEntry, id: string, length: number) => {
  return entry.type === 'uncompressed' && !isValidOffset(entry.offset, length)
    ? `Object ${id} is unavailable: invalid cross-reference offset ${entry.offset}.`
    : undefined;
};

const resolveObject = (index: ObjectIndex, number: number, entry: InUseEntry) => {
  const generation = entryGeneration(entry);
  const { encryptRef } = index;

  // The encryption dictionary itself is never encrypted.
  if (entry.type === 'uncompressed' && encryptRef?.objectNumber === number && encryptRef.generation === generation) {
    return inspectionReadIndirect(index.bytes, entry.offset).value;
  }

  return index.parsed.getObject(PdfRef.of(number, generation));
};

const loadObject = (index: ObjectIndex, [number, entry]: IndexedEntry) => {
  const id = entryId(number, entry);

  try {
    const offsetWarning = invalidOffsetWarning(entry, id, index.bytes.length);
    const object = offsetWarning ? undefined : resolveObject(index, number, entry);

    if (offsetWarning) {
      index.warnings.push(offsetWarning);
    } else if (!object) {
      index.warnings.push(`Object ${id} could not be resolved.`);
    } else {
      index.objects.set(id, object);
      if (isStream(object)) {
        index.streams.set(id, object);
      }
    }
  } catch (error) {
    index.warnings.push(`Object ${id}: ${errorMessage(error)}`);
  }
};

/** Resolves every in-use object. Streams are kept for later byte requests. */
const loadObjects = (index: ObjectIndex, entries: IndexedEntry[]) => {
  for (const entry of entries) {
    loadObject(index, entry);
  }
};

const sourcePreview = (bytes: Uint8Array, start: number, end: number) => {
  const preview = byteText(bytes.subarray(start, Math.min(end, start + MAX_DISPLAY_BYTES)));

  if (end - start <= MAX_DISPLAY_BYTES) {
    return preview;
  }

  return `${preview}\n… Source preview limited to 256 KiB. Inspect original bytes for the full object.`;
};

const numberObjectValue = (object: PdfObject | null) => {
  return object?.type === 'number' ? object.value : null;
};

// Also records the stream's original bytes, which raw reads and stream ranges use.
const fileSource = (index: ObjectIndex, number: number, entry: UncompressedEntry, id: string): SourceLocation | undefined => {
  const { bytes, parsed } = index;
  const result = inspectionReadIndirect(bytes, entry.offset, (ref) => {
    return numberObjectValue(parsed.getObject(ref));
  });

  if (result.objNum !== number || result.genNum !== entry.generation) {
    throw new Error('Cross-reference target has a different object identity.');
  }

  if (isStream(result.value)) {
    index.rawStreams.set(id, result.value.data);
  }

  const { end } = result;

  if (end === undefined || end <= entry.offset || end > bytes.length) {
    return undefined;
  }

  return {
    provenance: { range: { end, start: entry.offset }, type: 'file' },
    source: sourcePreview(bytes, entry.offset, end),
  };
};

const compressedSource = (index: ObjectIndex, number: number, entry: CompressedEntry): SourceLocation => {
  const containerId = entryId(entry.streamObjNum, index.parsed.xref.get(entry.streamObjNum));
  const stream = index.objects.get(containerId);

  if (!isStream(stream)) {
    throw new Error('Compressed object container is unavailable.');
  }

  const location = inspectionCompressedLocation(stream, entry.indexInStream, number);

  return {
    provenance: { containerId, range: { end: location.end, start: location.start }, type: 'decoded' },
    source: byteText(location.bytes.subarray(0, MAX_DISPLAY_BYTES)),
  };
};

const locateSource = (index: ObjectIndex, [number, entry]: IndexedEntry, id: string, warnings: string[]) => {
  try {
    return entry.type === 'uncompressed' ? fileSource(index, number, entry, id) : compressedSource(index, number, entry);
  } catch (error) {
    warnings.push(errorMessage(error));

    return undefined;
  }
};

const unverifiedSource = (text: string): SourceLocation => {
  return {
    provenance: { reason: 'The parser could not verify an exact source range.', type: 'unknown' },
    source: text,
  };
};

const dictionaryOf = (object: PdfObject) => {
  return object.type === 'dict' || object.type === 'stream' ? object : undefined;
};

const objectLabel = (object: PdfObject) => {
  const dictionary = dictionaryOf(object);
  const kind = dictionary?.getName('Type')?.value ?? (object.type === 'stream' ? 'Stream' : object.type);
  const subtype = dictionary?.getName('Subtype')?.value;

  return { kind, label: subtype ? `${kind} · ${subtype}` : kind };
};

// Raw stream bytes have a file range only when they are a view of the input.
const streamRange = (original: Uint8Array | undefined, bytes: Uint8Array): ByteRange | undefined => {
  if (!original || original.buffer !== bytes.buffer) {
    return undefined;
  }

  const start = original.byteOffset - bytes.byteOffset;

  return { end: start + original.byteLength, start };
};

const streamDetails = (object: PdfObject, original: Uint8Array | undefined, bytes: Uint8Array) => {
  return isStream(object)
    ? {
        stream: {
          filters: streamFilters(object),
          length: original?.length ?? object.data.length,
          range: streamRange(original, bytes),
        },
      }
    : {};
};

const buildRecord = (index: ObjectIndex, item: IndexedEntry): PdfObjectRecord | undefined => {
  const [number, entry] = item;
  const id = entryId(number, entry);
  const object = index.objects.get(id);

  if (!object) {
    return undefined;
  }

  const warnings: string[] = [];
  const references = new Set<string>();
  const value = valueTree(object, references);
  const { provenance, source } = locateSource(index, item, id, warnings) ?? unverifiedSource(value.text);

  return {
    generation: entryGeneration(entry),
    id,
    ...objectLabel(object),
    objectNumber: number,
    provenance,
    referencedBy: [],
    references: [...references],
    source,
    ...streamDetails(object, index.rawStreams.get(id), index.bytes),
    value,
    warnings,
  };
};

/** Builds a display record for every loaded object. Run after `loadObjects`. */
const buildRecords = (index: ObjectIndex, entries: IndexedEntry[]) => {
  const records = new Map<string, PdfObjectRecord>();

  for (const entry of entries) {
    const record = buildRecord(index, entry);

    if (record) {
      records.set(record.id, record);
    }
  }

  return records;
};

/**
 * Indexes the objects of one opened document in two passes. Every object is
 * loaded first, so compressed objects can find their container stream.
 */
export const indexObjects = (index: ObjectIndex, entries: IndexedEntry[]) => {
  loadObjects(index, entries);

  return buildRecords(index, entries);
};

const linkContainerRange = (record: PdfObjectRecord, records: Map<string, PdfObjectRecord>) => {
  if (record.provenance.type !== 'decoded') {
    return;
  }

  const container = records.get(record.provenance.containerId);

  if (container?.provenance.type === 'file') {
    record.provenance.containerRange = container.provenance.range;
  }
};

const linkReferences = (record: PdfObjectRecord, records: Map<string, PdfObjectRecord>) => {
  for (const id of record.references) {
    const target = records.get(id);

    if (target) {
      target.referencedBy.push(record.id);
    } else {
      record.warnings.push(`Dangling or unresolved reference: ${id} R`);
    }
  }
};

/** Fills in back-references, dangling-reference warnings and container ranges. */
export const linkRecords = (records: Map<string, PdfObjectRecord>) => {
  for (const record of records.values()) {
    linkContainerRange(record, records);
    linkReferences(record, records);
  }
};
