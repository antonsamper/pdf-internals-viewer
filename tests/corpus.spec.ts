import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import manifest from '../scripts/corpus/manifest.json';

type Fixture = (typeof manifest.files)[number];

interface SampleOffset {
  id: string;
  offset: number;
}

/** The fields of `scripts/corpus/probe-document.ts` output that the assertions read. */
interface ProbeResult {
  compressedObjects: number;
  error?: string;
  fileObjects: number;
  immutable: boolean;
  invalidRanges: string[];
  locked: boolean;
  objectIdsSha256: string;
  objects: number;
  pages: number;
  recovered: boolean;
  sampledOffsets: SampleOffset[];
  status: string;
  unknownObjectIds: string[];
  unknownObjects: number;
  warnings: string[];
}

const hash = (bytes: Uint8Array) => {
  return createHash('sha256').update(bytes).digest('hex');
};
const reports: unknown[] = [];

const readFixture = (fixture: Fixture) => {
  const filename = resolve('.context/corpus', fixture.filename);
  try {
    return { bytes: readFileSync(filename), filename };
  } catch {
    throw new Error(
      `Missing ${fixture.filename}. Run node scripts/corpus/fetch-corpus.mjs first; corpus tests never download files implicitly.`
    );
  }
};

const probe = (filename: string, offsets: SampleOffset[]): ProbeResult => {
  const child = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=384',
      '--experimental-strip-types',
      'scripts/corpus/probe-document.ts',
      filename,
      JSON.stringify(
        offsets.map((item) => {
          return item.id;
        })
      ),
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 15_000 }
  );
  expect(child.error, child.error?.message).toBeUndefined();
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout.trim().split('\n').at(-1)!);
};

const recordReport = (fixture: Fixture, result: ProbeResult) => {
  reports.push({ id: fixture.id, sha256: fixture.sha256, ...result });
  writeFileSync(
    resolve('.context/corpus-results.json'),
    JSON.stringify(
      {
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        recordedAt: new Date().toISOString(),
        results: reports,
      },
      null,
      2
    ) + '\n'
  );
};

const expectOracleObjects = (fixture: Fixture, result: ProbeResult) => {
  expect(result.objects).toBe(fixture.oracle.objects);
  expect(result.objectIdsSha256).toBe(fixture.oracle.objectIdsSha256);
  if (fixture.expectation === 'zero-offset-xref') {
    // Invalid entries are unavailable, never synthesized as source null objects.
    expect(result.fileObjects).toBe(fixture.oracle.objects);
    expect(result.warnings.join(' ')).toContain('invalid cross-reference offset');
  } else {
    expect(result.compressedObjects).toBe(fixture.oracle.compressedObjects);
  }
};

const expectSampledOffsets = (fixture: Fixture, offsets: SampleOffset[], result: ProbeResult) => {
  for (const offset of offsets) {
    if (fixture.expectedUnknownObjectIds?.includes(offset.id)) {
      expect(result.unknownObjectIds).toContain(offset.id);
    } else {
      expect(result.sampledOffsets).toContainEqual(offset);
    }
  }
};

const expectKnownRecovery = (fixture: Fixture, result: ProbeResult) => {
  if (fixture.id === 'pdfjs-scan-bad') {
    expect(result.recovered).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  }
  if (fixture.id === 'pdf-lib-missing_endobj_keyword') {
    expect(result.unknownObjects).toBeGreaterThan(0);
  }
};

const expectOracleMatch = (fixture: Fixture, offsets: SampleOffset[], result: ProbeResult) => {
  expect(result.pages).toBe(fixture.oracle.pages);
  if (fixture.oracle.popplerPages !== undefined) {
    expect(result.pages).toBe(fixture.oracle.popplerPages);
  }
  expectOracleObjects(fixture, result);
  expectSampledOffsets(fixture, offsets, result);
  expectKnownRecovery(fixture, result);
};

const expectStructure = (fixture: Fixture, offsets: SampleOffset[], result: ProbeResult) => {
  if (fixture.expectation === 'locked') {
    expect(result.locked).toBe(true);
    expect(result.objects).toBe(0);
    return;
  }
  expect(result.locked).toBe(false);
  if (fixture.expectation === 'partial-recovery') {
    // This damaged document needs more recovery than the current engine can do.
    // Accept improved recovery, but never silently lose all structure.
    expect(result.objects).toBeGreaterThan(0);
    expect(result.pages === fixture.oracle.pages || result.warnings.length > 0).toBe(true);
    return;
  }
  expectOracleMatch(fixture, offsets, result);
};

describe('opt-in, pinned upstream PDF corpus', () => {
  for (const fixture of manifest.files) {
    it(fixture.id, () => {
      const { bytes, filename } = readFixture(fixture);
      expect(bytes.length).toBe(fixture.size);
      expect(hash(bytes)).toBe(fixture.sha256);
      const offsets = fixture.oracle.sampleOffsets ?? [];
      const result = probe(filename, offsets);
      recordReport(fixture, result);
      expect(result.status, result.error).toBe('opened');
      expect(result.immutable).toBe(true);
      expect(result.invalidRanges).toEqual([]);
      expectStructure(fixture, offsets, result);
    });
  }
});
