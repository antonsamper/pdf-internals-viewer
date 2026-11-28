import { createHash } from 'node:crypto';
/** Isolated Node process: the runner enforces wall time and a heap limit. */
import { readFile } from 'node:fs/promises';

import { PdfInspector } from '../../src/lib/pdf/inspector.ts';

const filename = process.argv[2];
const bytes = new Uint8Array(await readFile(filename));
const before = createHash('sha256').update(bytes).digest('hex');
const requestedIds: string[] = JSON.parse(process.argv[3] ?? '[]');
const start = performance.now();
const inspector = new PdfInspector();

try {
  const document = await inspector.open(bytes, filename);
  const ids = document.objects
    .map((object) => {
      return object.id;
    })
    .toSorted();
  const invalidRanges = document.objects
    .filter((object) => {
      return (
        object.provenance.type === 'file' &&
        (object.provenance.range.start < 0 ||
          object.provenance.range.end > bytes.length ||
          object.provenance.range.start >= object.provenance.range.end)
      );
    })
    .map((object) => {
      return object.id;
    });
  const result = {
    compressedObjects: document.objects.filter((object) => {
      return object.provenance.type === 'decoded';
    }).length,
    fileObjects: document.objects.filter((object) => {
      return object.provenance.type === 'file';
    }).length,
    heapUsedMiB: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
    immutable: before === createHash('sha256').update(bytes).digest('hex'),
    invalidRanges,
    locked: document.locked,
    milliseconds: Math.round((performance.now() - start) * 100) / 100,
    objectIdsSha256: createHash('sha256').update(ids.join('\n')).digest('hex'),
    objectWarningCount: document.objects.reduce((total, object) => {
      return total + object.warnings.length;
    }, 0),
    objects: ids.length,
    pages: document.pages.length,
    recovered: document.recovered,
    sampledOffsets: document.objects
      .filter((object) => {
        return requestedIds.includes(object.id) && object.provenance.type === 'file';
      })
      .map((object) => {
        return {
          id: object.id,
          offset: object.provenance.type === 'file' ? object.provenance.range.start : -1,
        };
      }),
    status: 'opened',
    unknownObjectIds: document.objects
      .filter((object) => {
        return object.provenance.type === 'unknown';
      })
      .map((object) => {
        return object.id;
      }),
    unknownObjects: document.objects.filter((object) => {
      return object.provenance.type === 'unknown';
    }).length,
    warnings: document.warnings,
    xrefFormat: document.xrefFormat,
  };

  console.log(JSON.stringify(result));
} catch (reason) {
  console.log(
    JSON.stringify({
      error: reason instanceof Error ? reason.message : String(reason),
      milliseconds: Math.round(performance.now() - start),
      status: 'error',
    })
  );
}
