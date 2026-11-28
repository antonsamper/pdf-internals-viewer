import type { EmbeddedDownload } from './downloads';
import type { PdfObjectRecord } from './types';

import { embeddedDownloads } from './downloads';
import { resourceKind } from './resource-tools';
/** A single attachment row per embedded stream and filename, preferring its file specification. */
export const resourceCatalog = function resourceCatalog(
  objects: Map<string, PdfObjectRecord>,
  downloads = embeddedDownloads(objects)
): ResourceEntry[] {
  const entries: ResourceEntry[] = [];

  for (const object of objects.values()) {
    const kind = resourceKind(object);

    if (kind) {
      entries.push({
        downloads: (downloads.get(object.id) ?? []).filter((asset) => {
          return asset.kind === 'font';
        }),
        kind,
        object,
      });
    }
  }

  const seen = new Set<string>();
  const attachments = [...downloads.entries()].filter(([, assets]) => {
    return assets.some((asset) => {
      return asset.kind === 'attachment';
    });
  });

  // A named file specification is more helpful than its bare stream.
  attachments.sort(([a], [b]) => {
    return Number(Boolean(objects.get(a)?.stream)) - Number(Boolean(objects.get(b)?.stream));
  });
  for (const [id, assets] of attachments) {
    const object = objects.get(id);

    if (!object) {
      continue;
    }

    const unique = assets.filter((asset) => {
      if (asset.kind !== 'attachment') {
        return false;
      }

      const key = `${asset.streamId}:${asset.filename}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });

    if (unique.length) {
      entries.push({ downloads: unique, kind: 'Attachment', object });
    }
  }

  return entries;
};

export type ResourceCategory = 'All' | 'Font' | 'Attachment' | 'Image' | 'Form';
export interface ResourceEntry {
  object: PdfObjectRecord;
  kind: Exclude<ResourceCategory, 'All'>;
  downloads: EmbeddedDownload[];
}
