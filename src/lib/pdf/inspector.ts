import type { PdfDict, PdfObject, PdfRef as EngineRef, PdfStream } from '@libpdf/core';
import { InspectionDocumentParser, InspectionScanner, InspectionXRefParser, PdfRef, inspectionCompressedLocation, inspectionReadIndirect, inspectionResetDecodedCache, type XRefEntry } from 'pdf-internals-viewer/inspection';
import type { ByteRange, PdfDocumentInfo, PdfObjectRecord, PdfValue, Provenance, StreamResult } from './types';

export const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_DISPLAY_BYTES = 256 * 1024;
const MAX_OBJECTS = 100_000;
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const byteText = (bytes: Uint8Array) => { let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return text; };
const refId = (ref: EngineRef) => `${ref.objectNumber} ${ref.generation}`;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function valueTree(object: PdfObject, references: Set<string>, depth = 0): PdfValue {
  if (depth > 60) return { type: 'raw', value: '[Nesting limit reached]', text: '[Nesting limit reached]' };
  switch (object.type) {
    case 'null': return { type: 'null', text: 'null' };
    case 'bool': return { type: 'boolean', value: object.value, text: String(object.value) };
    case 'number': return { type: 'number', value: object.value, text: String(object.value) };
    case 'name': return { type: 'name', value: object.value, text: `/${object.value}` };
    case 'string': { const text = object.asString(); return { type: 'string', value: text, text: object.format === 'hex' ? `<${Array.from(object.bytes.subarray(0, 4096), b => b.toString(16).padStart(2, '0')).join('')}${object.bytes.length > 4096 ? '…' : ''}>` : `(${text.slice(0, 4096)})` }; }
    case 'ref': { const id = refId(object); references.add(id); return { type: 'reference', ref: id, text: `${id} R` }; }
    case 'array': { const items = object.toArray().map(item => valueTree(item, references, depth + 1)); return { type: 'array', items, text: `[ ${items.map(item => item.text).join(' ')} ]` }; }
    case 'dict':
    case 'stream': { const entries = Array.from(object, ([key, value]) => ({ key: key.value, value: valueTree(value, references, depth + 1) })); return { type: object.type === 'stream' ? 'stream' : 'dictionary', entries, text: `<<\n${entries.map(entry => `  /${entry.key} ${entry.value.text.replace(/\n/g, '\n  ')}`).join('\n')}\n>>` }; }
    case 'raw': { const text = byteText(object.bytes.subarray(0, MAX_DISPLAY_BYTES)); return { type: 'raw', value: text, text }; }
  }
}

const isStream = (object: PdfObject | undefined): object is PdfStream => object?.type === 'stream';

function streamFilters(stream: PdfStream): string[] {
  const filter = stream.get('Filter');
  if (!filter) return [];
  if (filter.type === 'name') return [filter.value];
  if (filter.type === 'array') return filter.toArray().map(item => item.type === 'name' ? item.value : 'Unsupported indirect filter');
  return ['Unsupported indirect filter'];
}

/** Read-only adapter around a pinned established parser; no PDF writing occurs. */
export class PdfInspector {
  private objects = new Map<string, PdfObject>();
  private records = new Map<string, PdfObjectRecord>();

  async open(bytes: Uint8Array, filename = 'document.pdf'): Promise<PdfDocumentInfo> {
    if (bytes.length > MAX_INPUT_BYTES) throw new Error('This file exceeds the 64 MiB inspection limit.');
    if (!bytes.length) throw new Error('This file is empty. Choose a PDF document.');
    this.objects.clear(); this.records.clear();
    inspectionResetDecodedCache();
    const parsed = new InspectionDocumentParser(new InspectionScanner(bytes), { lenient: true }).parse();
    const warnings = parsed.warnings.slice();
    let startXref: number | undefined;
    try { startXref = new InspectionXRefParser(new InspectionScanner(bytes)).findStartXRef(); } catch { /* recovery can still expose objects */ }
    const xrefFormat = startXref === undefined ? 'unknown' : byteText(bytes.subarray(startXref, startXref + 4)) === 'xref' ? parsed.trailer.has('XRefStm') ? 'hybrid' : 'table' : 'stream';
    const locked = parsed.isEncrypted;
    if (locked) warnings.push('Encrypted document: semantic inspection is locked in this version. Original file bytes remain available.');
    if (parsed.recoveredViaBruteForce) warnings.push('Recovered structure: cross-reference information was invalid. Object locations and relationships may be incomplete.');
    const entries = Array.from(parsed.xref).filter(([num, entry]) => num > 0 && entry.type !== 'free').sort(([a], [b]) => a - b);
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
          const object = parsed.getObject(PdfRef.of(number, generation));
          if (!object) { warnings.push(`Object ${id} could not be resolved.`); continue; }
          this.objects.set(id, object);
        } catch (error) { warnings.push(`Object ${id}: ${message(error)}`); }
      }
      for (const [number, entry] of entries) {
        const generation = entry.type === 'uncompressed' ? entry.generation : 0;
        const id = `${number} ${generation}`;
        const object = this.objects.get(id);
        if (!object) continue;
        const recordWarnings: string[] = [];
        const references = new Set<string>();
        const value = valueTree(object, references);
        let provenance: Provenance = { type: 'unknown', reason: 'The parser could not verify an exact source range.' };
        let source = value.text;
        try {
          if (entry.type === 'uncompressed') {
            const result = inspectionReadIndirect(bytes, entry.offset, ref => { const obj = parsed.getObject(ref); return obj?.type === 'number' ? obj.value : null; });
            if (result.objNum !== number || result.genNum !== generation) throw new Error('Cross-reference target has a different object identity.');
            if (result.end !== undefined && result.end > entry.offset && result.end <= bytes.length) {
              provenance = { type: 'file', range: { start: entry.offset, end: result.end } };
              source = byteText(bytes.subarray(entry.offset, Math.min(result.end, entry.offset + MAX_DISPLAY_BYTES)));
              if (result.end - entry.offset > MAX_DISPLAY_BYTES) source += '\n… Source preview limited to 256 KiB. Inspect original bytes for the full object.';
            }
          } else if (entry.type === 'compressed') {
            const containerEntry = parsed.xref.get(entry.streamObjNum);
            const containerId = `${entry.streamObjNum} ${containerEntry?.type === 'uncompressed' ? containerEntry.generation : 0}`;
            const stream = this.objects.get(containerId);
            if (!isStream(stream)) throw new Error('Compressed object container is unavailable.');
            const location = inspectionCompressedLocation(stream, entry.indexInStream, number);
            provenance = { type: 'decoded', containerId, range: { start: location.start, end: location.end } };
            source = byteText(location.bytes.subarray(0, MAX_DISPLAY_BYTES));
          }
        } catch (error) { recordWarnings.push(message(error)); }
        const dictionary = object.type === 'dict' || object.type === 'stream' ? object : undefined;
        const kind = dictionary?.getName('Type')?.value ?? (object.type === 'stream' ? 'Stream' : object.type);
        const subtype = dictionary?.getName('Subtype')?.value;
        const streamRange = isStream(object) && object.data.buffer === bytes.buffer ? { start: object.data.byteOffset - bytes.byteOffset, end: object.data.byteOffset - bytes.byteOffset + object.data.byteLength } : undefined;
        this.records.set(id, { id, objectNumber: number, generation, kind, label: subtype ? `${kind} · ${subtype}` : kind, value, source, provenance, references: [...references], referencedBy: [], ...(isStream(object) ? { stream: { length: object.data.length, filters: streamFilters(object), range: streamRange } } : {}), warnings: recordWarnings });
      }
    }
    for (const record of this.records.values()) {
      if (record.provenance.type === 'decoded') {
        const container = this.records.get(record.provenance.containerId);
        if (container?.provenance.type === 'file') record.provenance.containerRange = container.provenance.range;
      }
      for (const id of record.references) {
        const target = this.records.get(id);
        if (target) target.referencedBy.push(record.id);
        else record.warnings.push(`Dangling or unresolved reference: ${id} R`);
      }
    }
    let pages: string[] = [];
    if (!locked) { try { pages = parsed.getPages().map(refId); } catch (error) { warnings.push(`Page tree: ${message(error)}`); } }
    const root = parsed.trailer.getRef('Root');
    const catalog = !locked ? parsed.getCatalog() : null;
    return { filename, size: bytes.length, version: parsed.version, catalogVersion: catalog?.getName('Version')?.value, encrypted: parsed.isEncrypted, locked, recovered: parsed.recoveredViaBruteForce, catalogId: root ? refId(root) : undefined, pages, objects: [...this.records.values()], trailer: valueTree(parsed.trailer, new Set()), warnings: [...new Set([...warnings, ...parsed.warnings])], xrefFormat, startXref };
  }

  readStream(objectId: string, mode: 'raw' | 'decoded'): StreamResult {
    const object = this.objects.get(objectId);
    const result: StreamResult = { objectId, mode, bytes: new Uint8Array(), text: '', truncated: false };
    if (!isStream(object)) return { ...result, error: 'This object is not an available stream.' };
    try {
      // Image codecs can be passthrough in the underlying engine; never label their data decoded.
      if (mode === 'decoded') {
        const supported = new Set(['FlateDecode', 'Fl', 'ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85']);
        const unsupported = streamFilters(object).find(filter => !supported.has(filter));
        if (unsupported) throw new Error(`Decoded inspection does not support /${unsupported}. Raw stream bytes remain available.`);
      }
      const data = mode === 'raw' ? object.data : object.getDecodedData();
      if (data.length > MAX_DECODED_BYTES && mode === 'decoded') throw new Error('Decoded stream exceeds the 32 MiB inspection limit.');
      const bytes = data.slice(0, MAX_DISPLAY_BYTES);
      return { ...result, bytes, text: byteText(bytes), truncated: data.length > bytes.length };
    } catch (error) { return { ...result, error: message(error) }; }
  }
}

export const inspectPdf = (bytes: Uint8Array, filename?: string) => new PdfInspector().open(bytes, filename);
export type { ByteRange, XRefEntry, PdfDict };
