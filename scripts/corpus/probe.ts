/** Isolated Node process: the runner enforces wall time and a heap limit. */
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PdfInspector } from '../../src/lib/pdf/inspector.ts'

const filename = process.argv[2]
const bytes = new Uint8Array(await readFile(filename))
const before = createHash('sha256').update(bytes).digest('hex')
const requestedIds: string[] = JSON.parse(process.argv[3] ?? '[]')
const start = performance.now()
const inspector = new PdfInspector()
try {
  const document = await inspector.open(bytes, filename)
  const ids = document.objects.map(object => object.id).sort()
  const invalidRanges = document.objects.filter(object => object.provenance.type === 'file' && (object.provenance.range.start < 0 || object.provenance.range.end > bytes.length || object.provenance.range.start >= object.provenance.range.end)).map(object => object.id)
  const result = {
    status: 'opened',
    milliseconds: Math.round((performance.now() - start) * 100) / 100,
    pages: document.pages.length,
    objects: ids.length,
    objectIdsSha256: createHash('sha256').update(ids.join('\n')).digest('hex'),
    sampledOffsets: document.objects.filter(object => requestedIds.includes(object.id) && object.provenance.type === 'file').map(object => ({ id: object.id, offset: object.provenance.type === 'file' ? object.provenance.range.start : -1 })),
    fileObjects: document.objects.filter(object => object.provenance.type === 'file').length,
    compressedObjects: document.objects.filter(object => object.provenance.type === 'decoded').length,
    unknownObjects: document.objects.filter(object => object.provenance.type === 'unknown').length,
    unknownObjectIds: document.objects.filter(object => object.provenance.type === 'unknown').map(object => object.id),
    xrefFormat: document.xrefFormat,
    recovered: document.recovered,
    locked: document.locked,
    warnings: document.warnings,
    objectWarningCount: document.objects.reduce((total, object) => total + object.warnings.length, 0),
    invalidRanges,
    immutable: before === createHash('sha256').update(bytes).digest('hex'),
    heapUsedMiB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
  }
  console.log(JSON.stringify(result))
} catch (reason) {
  console.log(JSON.stringify({ status: 'error', milliseconds: Math.round(performance.now() - start), error: reason instanceof Error ? reason.message : String(reason) }))
}
