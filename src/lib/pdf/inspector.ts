import type { PdfDict, PdfStream } from '@libpdf/core';
import type { ParsedDocument, XRefEntry } from 'pdf-internals-viewer/inspection';

import {
  InspectionDocumentParser,
  InspectionScanner,
  InspectionXRefParser,
  inspectionResetDecodedCache,
} from 'pdf-internals-viewer/inspection';

import type { ObjectIndex } from './object-records.ts';
import type { ByteRange, PdfDocumentInfo, PdfObjectRecord, StreamResult } from './types';

import { byteText, errorMessage, isStream, refId, streamFilters } from './engine-objects.ts';
import { MAX_INPUT_BYTES, MAX_DISPLAY_BYTES, MAX_OBJECTS, MAX_DECODED_BYTES } from './limits.ts';
import { indexObjects, inUseEntries, linkRecords } from './object-records.ts';
import { valueTree } from './value-tree.ts';

export { MAX_INPUT_BYTES } from './limits.ts';

type StreamMode = 'raw' | 'decoded';
type StreamPurpose = 'preview' | 'download' | 'image' | 'size';

/** Details of one opening operation that end up in the document summary. */
interface OpenedDocument {
  bytes: Uint8Array;
  encryptionError: string | undefined;
  filename: string;
  locked: boolean;
  pages: string[];
  parsed: ParsedDocument;
  records: Map<string, PdfObjectRecord>;
  startXref: number | undefined;
  warnings: string[];
  xrefFormat: PdfDocumentInfo['xrefFormat'];
}

const SUPPORTED_DECODE_FILTERS = new Set(['FlateDecode', 'Fl', 'ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85']);

const assertInspectable = (bytes: Uint8Array) => {
  if (bytes.length > MAX_INPUT_BYTES) {
    throw new Error('This file exceeds the 64 MiB inspection limit.');
  }

  if (!bytes.length) {
    throw new Error('This file is empty. Choose a PDF document.');
  }
};

const parseDocument = (bytes: Uint8Array, password: string | undefined) => {
  return new InspectionDocumentParser(new InspectionScanner(bytes), {
    credentials: password,
    lenient: true,
  }).parse();
};

const findStartXref = (bytes: Uint8Array) => {
  try {
    return new InspectionXRefParser(new InspectionScanner(bytes)).findStartXRef();
  } catch {
    return undefined;
  }
};

const xrefFormat = (bytes: Uint8Array, startXref: number | undefined, trailer: PdfDict): PdfDocumentInfo['xrefFormat'] => {
  if (startXref === undefined) {
    return 'unknown';
  }

  if (byteText(bytes.subarray(startXref, startXref + 4)) !== 'xref') {
    return 'stream';
  }

  return trailer.has('XRefStm') ? 'hybrid' : 'table';
};

const encryptionError = (parsed: ParsedDocument, locked: boolean) => {
  return locked && !parsed.securityHandler ? 'The encryption information is invalid or unsupported. Try an unencrypted copy.' : undefined;
};

const documentWarnings = (parsed: ParsedDocument, locked: boolean, lockedReason: string | undefined) => {
  const warnings = parsed.warnings.slice();

  if (locked) {
    warnings.push(
      lockedReason ?? 'Encrypted document: a password is required for structure inspection. Original file bytes remain available.'
    );
  }

  if (parsed.isEncrypted && !locked) {
    warnings.push(
      'Encrypted document unlocked locally. Properties and decoded streams are decrypted; source, raw streams, and file offsets refer to the original encrypted bytes.'
    );
  }

  if (parsed.recoveredViaBruteForce) {
    warnings.push('Recovered structure: cross-reference information was invalid. Object locations and relationships may be incomplete.');
  }

  return warnings;
};

const inspectableEntries = (parsed: ParsedDocument) => {
  const entries = inUseEntries(parsed);

  if (entries.length > MAX_OBJECTS) {
    throw new Error('This PDF exceeds the 100,000 object inspection limit.');
  }

  return entries;
};

const pageIds = (parsed: ParsedDocument, locked: boolean, warnings: string[]) => {
  if (locked) {
    return [];
  }

  try {
    return parsed.getPages().map(refId);
  } catch (error) {
    warnings.push(`Page tree: ${errorMessage(error)}`);

    return [];
  }
};

const documentInfo = (opened: OpenedDocument): PdfDocumentInfo => {
  const { bytes, parsed } = opened;
  const root = parsed.trailer.getRef('Root');
  const catalog = opened.locked ? null : parsed.getCatalog();

  return {
    catalogId: root ? refId(root) : undefined,
    catalogVersion: catalog?.getName('Version')?.value,
    encrypted: parsed.isEncrypted,
    encryptionError: opened.encryptionError,
    filename: opened.filename,
    locked: opened.locked,
    objects: [...opened.records.values()],
    pages: opened.pages,
    recovered: parsed.recoveredViaBruteForce,
    size: bytes.length,
    startXref: opened.startXref,
    trailer: valueTree(parsed.trailer, new Set()),
    version: parsed.version,
    warnings: [...new Set([...opened.warnings, ...parsed.warnings])],
    xrefFormat: opened.xrefFormat,
  };
};

const assertImageStream = (object: PdfStream, purpose: StreamPurpose) => {
  if (purpose !== 'image') {
    return;
  }

  const subtype = object.get('Subtype');

  if (subtype?.type !== 'name' || subtype.value !== 'Image') {
    throw new Error('This object is not an image stream.');
  }
};

const isNativeJpeg = (filters: string[], mode: StreamMode, purpose: StreamPurpose) => {
  return purpose === 'image' && mode === 'decoded' && filters.length === 1 && ['DCTDecode', 'DCT'].includes(filters[0]);
};

const assertDecodable = (filters: string[]) => {
  const unsupported = filters.find((filter) => {
    return !SUPPORTED_DECODE_FILTERS.has(filter);
  });

  if (unsupported) {
    throw new Error(`Decoded inspection does not support /${unsupported}. Raw stream bytes remain available.`);
  }
};

const assertDeliverable = (data: Uint8Array, mode: StreamMode, purpose: StreamPurpose) => {
  if (data.length > MAX_DECODED_BYTES && mode === 'decoded') {
    throw new Error('Decoded stream exceeds the 32 MiB inspection limit.');
  }

  if (purpose !== 'preview' && mode !== 'decoded') {
    throw new Error('Downloads require decoded stream bytes.');
  }
};

const deliveredBytes = (data: Uint8Array, purpose: StreamPurpose) => {
  if (purpose === 'size') {
    return new Uint8Array();
  }

  return purpose === 'preview' ? data.slice(0, MAX_DISPLAY_BYTES) : data.slice();
};

const deliveredStream = (data: Uint8Array, purpose: StreamPurpose, nativeJpeg: boolean) => {
  const bytes = deliveredBytes(data, purpose);

  return {
    byteLength: data.length,
    bytes,
    text: purpose === 'preview' ? byteText(bytes) : '',
    truncated: purpose !== 'size' && data.length > bytes.length,
    ...(nativeJpeg ? { encoding: 'jpeg' as const } : {}),
  };
};

/** Read-only adapter around a pinned established parser; no PDF writing occurs. */
export class PdfInspector {
  private encrypted = false;
  private streams = new Map<string, PdfStream>();
  private rawStreams = new Map<string, Uint8Array>();
  async open(bytes: Uint8Array, filename = 'document.pdf', password?: string): Promise<PdfDocumentInfo> {
    assertInspectable(bytes);
    this.streams.clear();
    this.rawStreams.clear();
    inspectionResetDecodedCache();
    const parsed = parseDocument(bytes, password);

    this.encrypted = parsed.isEncrypted;
    const startXref = findStartXref(bytes);
    const locked = parsed.isEncrypted && !parsed.isAuthenticated;
    const lockedReason = encryptionError(parsed, locked);
    const warnings = documentWarnings(parsed, locked, lockedReason);
    const entries = inspectableEntries(parsed);
    // Object graphs and display records belong to this opening operation only.
    // After delivery the worker needs just streams for subsequent byte requests.
    const index: ObjectIndex = {
      bytes,
      encryptRef: parsed.trailer.getRef('Encrypt'),
      objects: new Map(),
      parsed,
      rawStreams: this.rawStreams,
      streams: this.streams,
      warnings,
    };
    const records = locked ? new Map<string, PdfObjectRecord>() : indexObjects(index, entries);

    linkRecords(records);

    return documentInfo({
      bytes,
      encryptionError: lockedReason,
      filename,
      locked,
      pages: pageIds(parsed, locked, warnings),
      parsed,
      records,
      startXref,
      warnings,
      xrefFormat: xrefFormat(bytes, startXref, parsed.trailer),
    });
  }
  readStream(objectId: string, mode: StreamMode, purpose: StreamPurpose = 'preview'): StreamResult {
    const object = this.streams.get(objectId);
    const result: StreamResult = {
      bytes: new Uint8Array(),
      mode,
      objectId,
      text: '',
      truncated: false,
    };

    if (!isStream(object)) {
      return { ...result, error: 'This object is not an available stream.' };
    }

    try {
      return { ...result, ...this.streamBytes(objectId, object, mode, purpose) };
    } catch (error) {
      return { ...result, error: errorMessage(error) };
    }
  }
  private streamBytes(objectId: string, object: PdfStream, mode: StreamMode, purpose: StreamPurpose) {
    const filters = streamFilters(object);

    assertImageStream(object, purpose);
    const nativeJpeg = isNativeJpeg(filters, mode, purpose);

    // Image codecs can be passthrough in the underlying engine; never label their data decoded.
    if (mode === 'decoded' && !nativeJpeg) {
      assertDecodable(filters);
    }

    const data = this.streamData(objectId, object, mode, nativeJpeg);

    assertDeliverable(data, mode, purpose);

    return deliveredStream(data, purpose, nativeJpeg);
  }
  private streamData(objectId: string, object: PdfStream, mode: StreamMode, nativeJpeg: boolean) {
    if (nativeJpeg) {
      return object.data;
    }

    if (mode === 'decoded') {
      return object.getDecodedData();
    }

    const raw = this.rawStreams.get(objectId);

    if (!raw && this.encrypted) {
      throw new Error('Original encrypted stream bytes could not be located. Inspect the original file bytes.');
    }

    return raw ?? object.data;
  }
}
export const inspectPdf = (bytes: Uint8Array, filename?: string) => {
  return new PdfInspector().open(bytes, filename);
};

export type { ByteRange, XRefEntry, PdfDict };
