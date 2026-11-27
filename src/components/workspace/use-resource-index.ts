import { useMemo } from 'react';

import type { ResourceEntry } from '@/lib/pdf/resource-catalog';
import type { PdfDocumentInfo, PdfObjectRecord } from '@/lib/pdf/types';

import { embeddedDownloads } from '@/lib/pdf/downloads';
import { resourceCatalog } from '@/lib/pdf/resource-catalog';

/** Embedded-file and resource indexes, preferring those the parser worker already built. */
export const useResourceIndex = (document: PdfDocumentInfo | null, objectMap: Map<string, PdfObjectRecord>) => {
  const downloadIndex = useMemo(() => {
    return document?.indexes ? new Map(document.indexes.downloads) : embeddedDownloads(objectMap);
  }, [document, objectMap]);
  const resourceEntries = useMemo<ResourceEntry[]>(() => {
    return document?.indexes
      ? document.indexes.resources.flatMap(({ objectId, ...entry }) => {
          const object = objectMap.get(objectId);
          return object ? [{ ...entry, object }] : [];
        })
      : resourceCatalog(objectMap, downloadIndex);
  }, [document, objectMap, downloadIndex]);
  const resourceObjects = useMemo(() => {
    return resourceEntries.map((entry) => {
      return entry.object;
    });
  }, [resourceEntries]);
  return { downloadIndex, resourceEntries, resourceObjects };
};
