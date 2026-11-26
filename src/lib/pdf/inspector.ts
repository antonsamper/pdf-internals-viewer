import type { PdfDict, PdfObject, PdfRef as EngineRef, PdfStream } from '@libpdf/core';
import type { XRefEntry } from 'pdf-internals-viewer/inspection';

import {
  InspectionDocumentParser,
  InspectionScanner,
  InspectionXRefParser,
  PdfRef,
  inspectionCompressedLocation,
  inspectionReadIndirect,
  inspectionResetDecodedCache,
} from 'pdf-internals-viewer/inspection';

import type { ByteRange, PdfDocumentInfo, PdfObjectRecord, PdfValue, Provenance, StreamResult } from './types';

import { MAX_INPUT_BYTES, MAX_DISPLAY_BYTES, MAX_OBJECTS, MAX_DECODED_BYTES } from './limits.ts';
const valueTree = (object: PdfObject, references: Set<string>, depth = 0): PdfValue => {
  if (depth > 60)
    return {
      text: '[Nesting limit reached]',
      type: 'raw',
      value: '[Nesting limit reached]',
    };
  switch (object.type) {
    case 'null':
      return { text: 'null', type: 'null' };
    case 'bool':
      return {
        text: String(object.value),
        type: 'boolean',
        value: object.value,
      };
    case 'number':
      return { text: String(object.value), type: 'number', value: object.value };
    case 'name':
      return { text: `/${object.value}`, type: 'name', value: object.value };
    case 'string': {
      const text = object.asString();
      return {
        text:
          object.format === 'hex'
            ? `<${Array.from(object.bytes.subarray(0, 4096), (b) => b.toString(16).padStart(2, '0')).join('')}${object.bytes.length > 4096 ? '…' : ''}>`
            : `(${text.slice(0, 4096)})`,
        type: 'string',
        value: text,
      };
    }
    case 'ref': {
      const id = refId(object);
      references.add(id);
      return { ref: id, text: `${id} R`, type: 'reference' };
    }
    case 'array': {
      const items = object.toArray().map((item) => valueTree(item, references, depth + 1));
      return {
        items,
        text: `[ ${items.map((item) => item.text).join(' ')} ]`,
        type: 'array',
      };
    }
    case 'dict':
    case 'stream': {
      const entries = Array.from(object, ([key, value]) => ({
        key: key.value,
        value: valueTree(value, references, depth + 1),
      }));
      return {
        entries,
        text: `<<\n${entries.map((entry) => `  /${entry.key} ${entry.value.text.replace(/\n/g, '\n  ')}`).join('\n')}\n>>`,
        type: object.type === 'stream' ? 'stream' : 'dictionary',
      };
    }
    case 'raw': {
      const text = byteText(object.bytes.subarray(0, MAX_DISPLAY_BYTES));
      return { text, type: 'raw', value: text };
    }
  }
};
const streamFilters = (stream: PdfStream): string[] => {
  const filter = stream.get('Filter');
  if (!filter) return [];
  if (filter.type === 'name') return [filter.value];
  if (filter.type === 'array') return filter.toArray().map((item) => (item.type === 'name' ? item.value : 'Unsupported indirect filter'));
  return ['Unsupported indirect filter'];
};
export { MAX_INPUT_BYTES } from './limits.ts';
const byteText = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return text;
};
const refId = (ref: EngineRef) => `${ref.objectNumber} ${ref.generation}`;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isStream = (object: PdfObject | undefined): object is PdfStream => object?.type === 'stream';
/** Read-only adapter around a pinned established parser; no PDF writing occurs. */
export class PdfInspector {
  private encrypted = false;
  private streams = new Map<string, PdfStream>();
  private rawStreams = new Map<string, Uint8Array>();
  async open(bytes: Uint8Array, filename = 'document.pdf', password?: string): Promise<PdfDocumentInfo> {
    if (bytes.length > MAX_INPUT_BYTES) throw new Error('This file exceeds the 64 MiB inspection limit.');
    if (!bytes.length) throw new Error('This file is empty. Choose a PDF document.');
    this.streams.clear();
    this.rawStreams.clear();
    // Object graphs and display records belong to this opening operation only.
    // After delivery the worker needs just streams for subsequent byte requests.
    const objects = new Map<string, PdfObject>();
    const records = new Map<string, PdfObjectRecord>();
    inspectionResetDecodedCache();
    const parsed = new InspectionDocumentParser(new InspectionScanner(bytes), {
      credentials: password,
      lenient: true,
    }).parse();
    this.encrypted = parsed.isEncrypted;
    const warnings = parsed.warnings.slice();
    let startXref: number | undefined;
    try {
      startXref = new InspectionXRefParser(new InspectionScanner(bytes)).findStartXRef();
    } catch {}
    const xrefFormat =
      startXref === undefined
        ? 'unknown'
        : byteText(bytes.subarray(startXref, startXref + 4)) === 'xref'
          ? parsed.trailer.has('XRefStm')
            ? 'hybrid'
            : 'table'
          : 'stream';
    const locked = parsed.isEncrypted && !parsed.isAuthenticated;
    const encryptionError =
      locked && !parsed.securityHandler ? 'The encryption information is invalid or unsupported. Try an unencrypted copy.' : undefined;
    const encryptRef = parsed.trailer.getRef('Encrypt');
    if (locked)
      warnings.push(
        encryptionError ?? 'Encrypted document: a password is required for structure inspection. Original file bytes remain available.'
      );
    if (parsed.isEncrypted && !locked)
      warnings.push(
        'Encrypted document unlocked locally. Properties and decoded streams are decrypted; source, raw streams, and file offsets refer to the original encrypted bytes.'
      );
    if (parsed.recoveredViaBruteForce)
      warnings.push('Recovered structure: cross-reference information was invalid. Object locations and relationships may be incomplete.');
    const entries = Array.from(parsed.xref)
      .filter(([num, entry]) => num > 0 && entry.type !== 'free')
      .toSorted(([a], [b]) => a - b);
    if (entries.length > MAX_OBJECTS) throw new Error('This PDF exceeds the 100,000 object inspection limit.');
    if (!locked) {
      for (const [number, entry] of entries) {
        const generation = entry.type === 'uncompressed' ? entry.generation : 0;
        const id = `${number} ${generation}`;
        try {
          // A malformed in-use xref at offset zero may resolve to the engine's
          // synthetic null placeholder. It is not an indexed source object.
          if (entry.type === 'uncompressed' && (!Number.isSafeInteger(entry.offset) || entry.offset <= 0 || entry.offset >= bytes.length)) {
            warnings.push(`Object ${id} is unavailable: invalid cross-reference offset ${entry.offset}.`);
            continue;
          }
          // The encryption dictionary itself is never encrypted.
          const object =
            encryptRef?.objectNumber === number && encryptRef.generation === generation && entry.type === 'uncompressed'
              ? inspectionReadIndirect(bytes, entry.offset).value
              : parsed.getObject(PdfRef.of(number, generation));
          if (!object) {
            warnings.push(`Object ${id} could not be resolved.`);
            continue;
          }
          objects.set(id, object);
          if (isStream(object)) this.streams.set(id, object);
        } catch (error) {
          warnings.push(`Object ${id}: ${message(error)}`);
        }
      }
      for (const [number, entry] of entries) {
        const generation = entry.type === 'uncompressed' ? entry.generation : 0;
        const id = `${number} ${generation}`;
        const object = objects.get(id);
        if (!object) continue;
        const recordWarnings: string[] = [];
        const references = new Set<string>();
        const value = valueTree(object, references);
        let provenance: Provenance = {
          reason: 'The parser could not verify an exact source range.',
          type: 'unknown',
        };
        let source = value.text;
        try {
          if (entry.type === 'uncompressed') {
            const result = inspectionReadIndirect(bytes, entry.offset, (ref) => {
              const obj = parsed.getObject(ref);
              return obj?.type === 'number' ? obj.value : null;
            });
            if (result.objNum !== number || result.genNum !== generation)
              throw new Error('Cross-reference target has a different object identity.');
            if (isStream(result.value)) this.rawStreams.set(id, result.value.data);
            if (result.end !== undefined && result.end > entry.offset && result.end <= bytes.length) {
              provenance = {
                range: { end: result.end, start: entry.offset },
                type: 'file',
              };
              source = byteText(bytes.subarray(entry.offset, Math.min(result.end, entry.offset + MAX_DISPLAY_BYTES)));
              if (result.end - entry.offset > MAX_DISPLAY_BYTES)
                source += '\n… Source preview limited to 256 KiB. Inspect original bytes for the full object.';
            }
          } else if (entry.type === 'compressed') {
            const containerEntry = parsed.xref.get(entry.streamObjNum);
            const containerId = `${entry.streamObjNum} ${containerEntry?.type === 'uncompressed' ? containerEntry.generation : 0}`;
            const stream = objects.get(containerId);
            if (!isStream(stream)) throw new Error('Compressed object container is unavailable.');
            const location = inspectionCompressedLocation(stream, entry.indexInStream, number);
            provenance = {
              containerId,
              range: { end: location.end, start: location.start },
              type: 'decoded',
            };
            source = byteText(location.bytes.subarray(0, MAX_DISPLAY_BYTES));
          }
        } catch (error) {
          recordWarnings.push(message(error));
        }
        const dictionary = object.type === 'dict' || object.type === 'stream' ? object : undefined;
        const kind = dictionary?.getName('Type')?.value ?? (object.type === 'stream' ? 'Stream' : object.type);
        const subtype = dictionary?.getName('Subtype')?.value;
        const originalStream = this.rawStreams.get(id);
        const streamRange =
          originalStream?.buffer === bytes.buffer
            ? {
                end: originalStream.byteOffset - bytes.byteOffset + originalStream.byteLength,
                start: originalStream.byteOffset - bytes.byteOffset,
              }
            : undefined;
        records.set(id, {
          generation,
          id,
          kind,
          label: subtype ? `${kind} · ${subtype}` : kind,
          objectNumber: number,
          provenance,
          referencedBy: [],
          references: [...references],
          source,
          ...(isStream(object)
            ? {
                stream: {
                  filters: streamFilters(object),
                  length: originalStream?.length ?? object.data.length,
                  range: streamRange,
                },
              }
            : {}),
          value,
          warnings: recordWarnings,
        });
      }
    }
    for (const record of records.values()) {
      if (record.provenance.type === 'decoded') {
        const container = records.get(record.provenance.containerId);
        if (container?.provenance.type === 'file') record.provenance.containerRange = container.provenance.range;
      }
      for (const id of record.references) {
        const target = records.get(id);
        if (target) target.referencedBy.push(record.id);
        else record.warnings.push(`Dangling or unresolved reference: ${id} R`);
      }
    }
    let pages: string[] = [];
    if (!locked) {
      try {
        pages = parsed.getPages().map(refId);
      } catch (error) {
        warnings.push(`Page tree: ${message(error)}`);
      }
    }
    const root = parsed.trailer.getRef('Root');
    const catalog = !locked ? parsed.getCatalog() : null;
    return {
      catalogId: root ? refId(root) : undefined,
      catalogVersion: catalog?.getName('Version')?.value,
      encrypted: parsed.isEncrypted,
      encryptionError,
      filename,
      locked,
      objects: [...records.values()],
      pages,
      recovered: parsed.recoveredViaBruteForce,
      size: bytes.length,
      startXref,
      trailer: valueTree(parsed.trailer, new Set()),
      version: parsed.version,
      warnings: [...new Set([...warnings, ...parsed.warnings])],
      xrefFormat,
    };
  }
  readStream(objectId: string, mode: 'raw' | 'decoded', purpose: 'preview' | 'download' | 'image' | 'size' = 'preview'): StreamResult {
    const object = this.streams.get(objectId);
    const result: StreamResult = {
      bytes: new Uint8Array(),
      mode,
      objectId,
      text: '',
      truncated: false,
    };
    if (!isStream(object)) return { ...result, error: 'This object is not an available stream.' };
    try {
      const filters = streamFilters(object);
      const subtype = object.get('Subtype');
      if (purpose === 'image' && (subtype?.type !== 'name' || subtype.value !== 'Image'))
        throw new Error('This object is not an image stream.');
      const nativeJpeg = purpose === 'image' && mode === 'decoded' && filters.length === 1 && ['DCTDecode', 'DCT'].includes(filters[0]);
      // Image codecs can be passthrough in the underlying engine; never label their data decoded.
      if (mode === 'decoded' && !nativeJpeg) {
        const supported = new Set(['FlateDecode', 'Fl', 'ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85']);
        const unsupported = filters.find((filter) => !supported.has(filter));
        if (unsupported) throw new Error(`Decoded inspection does not support /${unsupported}. Raw stream bytes remain available.`);
      }
      if (mode === 'raw' && this.encrypted && !this.rawStreams.has(objectId))
        throw new Error('Original encrypted stream bytes could not be located. Inspect the original file bytes.');
      const data = nativeJpeg ? object.data : mode === 'raw' ? (this.rawStreams.get(objectId) ?? object.data) : object.getDecodedData();
      if (data.length > MAX_DECODED_BYTES && mode === 'decoded') throw new Error('Decoded stream exceeds the 32 MiB inspection limit.');
      if (purpose !== 'preview' && mode !== 'decoded') throw new Error('Downloads require decoded stream bytes.');
      const bytes = purpose === 'size' ? new Uint8Array() : purpose !== 'preview' ? data.slice() : data.slice(0, MAX_DISPLAY_BYTES);
      return {
        ...result,
        byteLength: data.length,
        bytes,
        text: purpose !== 'preview' ? '' : byteText(bytes),
        truncated: purpose !== 'size' && data.length > bytes.length,
        ...(nativeJpeg ? { encoding: 'jpeg' as const } : {}),
      };
    } catch (error) {
      return { ...result, error: message(error) };
    }
  }
}
export const inspectPdf = (bytes: Uint8Array, filename?: string) => new PdfInspector().open(bytes, filename);
export type { ByteRange, XRefEntry, PdfDict };
