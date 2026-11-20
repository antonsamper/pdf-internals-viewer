/** Serializable inspection data. Ranges are zero-based and half-open. */
export interface ByteRange { start: number; end: number }
export type PdfValue =
  | { type: 'null'; text: string }
  | { type: 'boolean'; value: boolean; text: string }
  | { type: 'number'; value: number; text: string }
  | { type: 'name' | 'string' | 'raw'; value: string; text: string }
  | { type: 'reference'; ref: string; text: string }
  | { type: 'array'; items: PdfValue[]; text: string }
  | { type: 'dictionary' | 'stream'; entries: { key: string; value: PdfValue }[]; text: string };
export type Provenance =
  | { type: 'file'; range: ByteRange }
  | { type: 'decoded'; containerId: string; range: ByteRange; containerRange?: ByteRange }
  | { type: 'unknown'; reason: string };
export interface PdfObjectRecord {
  id: string;
  objectNumber: number;
  generation: number;
  kind: string;
  label: string;
  value: PdfValue;
  source: string;
  provenance: Provenance;
  references: string[];
  referencedBy: string[];
  stream?: { length: number; filters: string[]; range?: ByteRange };
  warnings: string[];
}
export interface PdfDocumentInfo {
  filename: string;
  size: number;
  version: string;
  catalogVersion?: string;
  encrypted: boolean;
  locked: boolean;
  encryptionError?: string;
  recovered: boolean;
  catalogId?: string;
  pages: string[];
  objects: PdfObjectRecord[];
  trailer: PdfValue;
  warnings: string[];
  xrefFormat: 'table' | 'stream' | 'hybrid' | 'unknown';
  startXref?: number;
}
export interface StreamResult {
  objectId: string;
  mode: 'raw' | 'decoded';
  bytes: Uint8Array;
  text: string;
  truncated: boolean;
  error?: string;
}
export type ParserRequest =
  | { requestId: number; type: 'open'; password?: string; bytes: Uint8Array; filename: string }
  | { requestId: number; type: 'stream'; objectId: string; mode: 'raw' | 'decoded' };
export type ParserResponse =
  | { requestId: number; type: 'opened'; document: PdfDocumentInfo }
  | { requestId: number; type: 'stream'; result: StreamResult }
  | { requestId: number; type: 'error'; error: string };
