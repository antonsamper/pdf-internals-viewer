import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import manifest from '../scripts/corpus/manifest.json'

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const reports: unknown[] = []
describe('opt-in, pinned upstream PDF corpus', () => {
  for (const fixture of manifest.files) it(fixture.id, () => {
    const filename = resolve('.context/corpus', fixture.filename)
    let bytes: Buffer
    try { bytes = readFileSync(filename) }
    catch { throw new Error(`Missing ${fixture.filename}. Run node scripts/corpus/fetch.mjs first; corpus tests never download files implicitly.`) }
    expect(bytes.length).toBe(fixture.size)
    expect(hash(bytes)).toBe(fixture.sha256)
    const offsets = fixture.oracle.sampleOffsets ?? []
    const child = spawnSync(process.execPath, ['--max-old-space-size=384', '--experimental-strip-types', 'scripts/corpus/probe.ts', filename, JSON.stringify(offsets.map(item => item.id))], { timeout: 15_000, encoding: 'utf8', maxBuffer: 1024 * 1024 })
    expect(child.error, child.error?.message).toBeUndefined()
    expect(child.status, child.stderr).toBe(0)
    const result = JSON.parse(child.stdout.trim().split('\n').at(-1)!)
    reports.push({ id: fixture.id, sha256: fixture.sha256, ...result })
    writeFileSync(resolve('.context/corpus-results.json'), JSON.stringify({ recordedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`, results: reports }, null, 2) + '\n')
    expect(result.status, result.error).toBe('opened')
    expect(result.immutable).toBe(true)
    expect(result.invalidRanges).toEqual([])
    if (fixture.expectation === 'locked') {
      expect(result.locked).toBe(true)
      expect(result.objects).toBe(0)
      return
    }
    expect(result.locked).toBe(false)
    if (fixture.expectation === 'partial-recovery') {
      // This damaged document needs more recovery than the current engine can do.
      // Accept improved recovery, but never silently lose all structure.
      expect(result.objects).toBeGreaterThan(0)
      expect(result.pages === fixture.oracle.pages || result.warnings.length > 0).toBe(true)
      return
    }
    expect(result.pages).toBe(fixture.oracle.pages)
    if (fixture.oracle.popplerPages !== undefined) expect(result.pages).toBe(fixture.oracle.popplerPages)
    if (fixture.expectation === 'zero-offset-xref') {
      // Invalid entries are unavailable, never synthesized as source null objects.
      expect(result.objects).toBe(fixture.oracle.objects)
      expect(result.objectIdsSha256).toBe(fixture.oracle.objectIdsSha256)
      expect(result.fileObjects).toBe(fixture.oracle.objects)
      expect(result.warnings.join(' ')).toContain('invalid cross-reference offset')
    } else {
      expect(result.objects).toBe(fixture.oracle.objects)
      expect(result.objectIdsSha256).toBe(fixture.oracle.objectIdsSha256)
      expect(result.compressedObjects).toBe(fixture.oracle.compressedObjects)
    }
    for (const offset of offsets) {
      if (fixture.expectedUnknownObjectIds?.includes(offset.id)) expect(result.unknownObjectIds).toContain(offset.id)
      else expect(result.sampledOffsets).toContainEqual(offset)
    }
    if (fixture.id === 'pdfjs-scan-bad') {
      expect(result.recovered).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    }
    if (fixture.id === 'pdf-lib-missing_endobj_keyword') expect(result.unknownObjects).toBeGreaterThan(0)
  })
})
