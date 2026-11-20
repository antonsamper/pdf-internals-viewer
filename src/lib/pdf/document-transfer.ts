import { embeddedDownloads, type EmbeddedDownload } from './downloads';
import { resourceCatalog, type ResourceEntry } from './resource-catalog';
import type { PdfDocumentInfo, PdfObjectRecord } from './types';

export interface InspectionIndexes {
  downloads: [string, EmbeddedDownload[]][];
  resources: (Omit<ResourceEntry, 'object'> & { objectId: string })[];
}

export type DocumentTransferItem =
  | { type: 'document'; document: Omit<PdfDocumentInfo, 'objects' | 'indexes'> }
  | { type: 'object'; object: PdfObjectRecord }
  | { type: 'download'; entry: InspectionIndexes['downloads'][number] }
  | { type: 'resource'; entry: InspectionIndexes['resources'][number] };

/** Keep each response small; a single oversized record is sent on its own.
 * Source/value/provenance are preserved exactly, including strings and unknown keys.
 */
export const TRANSFER_BATCH_CHARACTERS = 128 * 1024;
const TRANSFER_BATCH_ITEMS = 128;

function* documentItems(document: PdfDocumentInfo): Generator<DocumentTransferItem> {
  const { objects, ...header } = document;
  delete header.indexes;
  const objectMap = new Map(objects.map(object => [object.id, object]));
  const downloads = embeddedDownloads(objectMap);
  const resources = resourceCatalog(objectMap, downloads);
  yield { type: 'document', document: header };
  for (const object of objects) yield { type: 'object', object };
  for (const entry of downloads) yield { type: 'download', entry };
  for (const { object, ...entry } of resources) yield { type: 'resource', entry: { ...entry, objectId: object.id } };
}

/** Pull protocol: only one bounded batch is in flight. Each acknowledgement
 * creates a new browser task, giving rendering and cancellation a chance to run.
 * Keep structured cloning so numbers and optional fields retain their exact values.
 */
export class DocumentTransfer {
  private items: Generator<DocumentTransferItem>;
  private queued: DocumentTransferItem | undefined;
  constructor(document: PdfDocumentInfo) { this.items = documentItems(document); }
  next(): { items: DocumentTransferItem[]; done: boolean } {
    const batch: DocumentTransferItem[] = [];
    let characters = 2;
    let done = false;
    while (batch.length < TRANSFER_BATCH_ITEMS) {
      if (this.queued === undefined) {
        const item = this.items.next();
        if (item.done) { done = true; break; }
        this.queued = item.value;
      }
      const length = JSON.stringify(this.queued).length;
      if (batch.length && characters + length + 1 > TRANSFER_BATCH_CHARACTERS) break;
      batch.push(this.queued);
      characters += length + 1;
      this.queued = undefined;
    }
    return { items: batch, done };
  }
}

/** Build once, before publishing the document to React. No partial graph escapes. */
export class DocumentReceiver {
  private header: Omit<PdfDocumentInfo, 'objects' | 'indexes'> | undefined;
  private objects: PdfObjectRecord[] = [];
  private indexes: InspectionIndexes = { downloads: [], resources: [] };
  accept(items: DocumentTransferItem[]): void {
    for (const item of items) {
      switch (item.type) {
        case 'document': this.header = item.document; break;
        case 'object': this.objects.push(item.object); break;
        case 'download': this.indexes.downloads.push(item.entry); break;
        case 'resource': this.indexes.resources.push(item.entry); break;
      }
    }
  }
  finish(): PdfDocumentInfo {
    if (!this.header) throw new Error('The document transfer did not include its summary.');
    return { ...this.header, objects: this.objects, indexes: this.indexes };
  }
}
