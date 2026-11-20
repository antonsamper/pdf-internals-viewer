import type { PdfDocumentInfo, PdfObjectRecord, PdfValue } from './types';

import { embeddedDownloads, type EmbeddedDownload } from './downloads';
import { resourceCatalog, type ResourceEntry } from './resource-catalog';
const documentItems = function* documentItems(document: PdfDocumentInfo): Generator<DocumentTransferItem> {
  const { objects, ...header } = document;
  delete header.indexes;
  const objectMap = new Map(objects.map((object) => [object.id, object]));
  const downloads = embeddedDownloads(objectMap);
  const resources = resourceCatalog(objectMap, downloads);
  yield { document: header, type: 'document' };
  for (const object of objects) yield { object, type: 'object' };
  for (const entry of downloads) yield { entry, type: 'download' };
  for (const { object, ...entry } of resources) yield { entry: { ...entry, objectId: object.id }, type: 'resource' };
};
export interface InspectionIndexes {
  downloads: [string, EmbeddedDownload[]][];
  resources: (Omit<ResourceEntry, 'object'> & {
    objectId: string;
  })[];
}
export type DocumentTransferItem =
  | {
      type: 'document';
      document: Omit<PdfDocumentInfo, 'objects' | 'indexes'>;
    }
  | {
      type: 'object';
      object: PdfObjectRecord;
    }
  | {
      type: 'download';
      entry: InspectionIndexes['downloads'][number];
    }
  | {
      type: 'resource';
      entry: InspectionIndexes['resources'][number];
    };
/** Keep each response small; a single oversized record is sent on its own.
 * Source/value/provenance are preserved exactly, including strings and unknown keys.
 */
export const TRANSFER_BATCH_CHARACTERS = 128 * 1024;
const TRANSFER_BATCH_ITEMS = 128;
const MAX_SHARED_SCALARS = 100000;
/** Pull protocol: only one bounded batch is in flight. Each acknowledgement
 * creates a new browser task, giving rendering and cancellation a chance to run.
 * Keep structured cloning so numbers and optional fields retain their exact values.
 */
export class DocumentTransfer {
  private items: Generator<DocumentTransferItem>;
  private queued: DocumentTransferItem | undefined;
  constructor(document: PdfDocumentInfo) {
    this.items = documentItems(document);
  }
  next(): {
    items: DocumentTransferItem[];
    done: boolean;
  } {
    const batch: DocumentTransferItem[] = [];
    let characters = 2;
    let done = false;
    while (batch.length < TRANSFER_BATCH_ITEMS) {
      if (this.queued === undefined) {
        const item = this.items.next();
        if (item.done) {
          done = true;
          break;
        }
        this.queued = item.value;
      }
      const length = JSON.stringify(this.queued).length;
      if (batch.length && characters + length + 1 > TRANSFER_BATCH_CHARACTERS) break;
      batch.push(this.queued);
      characters += length + 1;
      this.queued = undefined;
    }
    return { done, items: batch };
  }
}
/** Build once, before publishing the document to React. No partial graph escapes. */
export class DocumentReceiver {
  // Only scalar leaves are shared. Dictionary/array ownership and reference paths
  // stay independent, and the pool itself is released before publishing the graph.
  private values = new Map<string, PdfValue>();
  private share(value: PdfValue): PdfValue {
    if (value.type === 'array') {
      for (let i = 0; i < value.items.length; i++) value.items[i] = this.share(value.items[i]);
    } else if (value.type === 'dictionary' || value.type === 'stream') {
      for (const entry of value.entries) entry.value = this.share(entry.value);
    } else {
      // Preserve any future/extended fields rather than silently merging them.
      if (Object.keys(value).length !== (value.type === 'null' ? 2 : 3)) return value;
      const existing = this.values.get(value.text);
      if (
        existing?.type === value.type &&
        (value.type === 'null' ||
          ('ref' in value && 'ref' in existing && value.ref === existing.ref) ||
          ('value' in value && 'value' in existing && Object.is(value.value, existing.value)))
      )
        return existing;
      // The displayed text is the lookup key, but never the equality test: long
      // strings may have the same truncated display and different full values.
      if (!existing && this.values.size < MAX_SHARED_SCALARS) this.values.set(value.text, Object.freeze(value));
    }
    return value;
  }
  private header: Omit<PdfDocumentInfo, 'objects' | 'indexes'> | undefined;
  private objects: PdfObjectRecord[] = [];
  private indexes: InspectionIndexes = { downloads: [], resources: [] };
  accept(items: DocumentTransferItem[]): void {
    for (const item of items) {
      switch (item.type) {
        case 'document':
          this.header = item.document;
          this.header.trailer = this.share(this.header.trailer);
          break;
        case 'object':
          item.object.value = this.share(item.object.value);
          this.objects.push(item.object);
          break;
        case 'download':
          this.indexes.downloads.push(item.entry);
          break;
        case 'resource':
          this.indexes.resources.push(item.entry);
          break;
      }
    }
  }
  finish(): PdfDocumentInfo {
    if (!this.header) throw new Error('The document transfer did not include its summary.');
    this.values.clear();
    return { ...this.header, indexes: this.indexes, objects: this.objects };
  }
}
