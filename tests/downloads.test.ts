import { describe, expect, it } from 'vitest';

import type { PdfObjectRecord, PdfValue } from '../src/lib/pdf/types';

// @ts-expect-error shared JavaScript fixture generator
import { embeddedFilesPdf, classicPdf, oversizedDecodedPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { downloadFilename, embeddedDownloads } from '../src/lib/pdf/downloads';
import { PdfInspector } from '../src/lib/pdf/inspector';

describe('embedded file extraction', () => {
  it('exports complete binary data beyond the display limit and resolves Unicode attachment filenames', async () => {
    const fixture = embeddedFilesPdf();
    const inspector = new PdfInspector();
    const document = await inspector.open(fixture.bytes);
    const index = embeddedDownloads(
      new Map(
        document.objects.map((object) => {
          return [object.id, object];
        })
      )
    );
    expect(index.get('6 0')).toEqual([
      {
        filename: 'report.txt',
        kind: 'attachment',
        streamId: '7 0',
        subset: false,
      },
    ]);
    expect(index.get('7 0')).toEqual(index.get('6 0'));
    expect(inspector.readStream('7 0', 'decoded').truncated).toBe(true);
    const download = inspector.readStream('7 0', 'decoded', 'download');
    expect(download.error).toBeUndefined();
    expect(download.truncated).toBe(false);
    expect(download.bytes).toEqual(new Uint8Array(fixture.attachment));
    expect(download.text).toBe('');
    const measured = inspector.readStream('7 0', 'decoded', 'size');
    expect(measured.byteLength).toBe(fixture.attachment.length);
    expect(measured.bytes).toHaveLength(0);
    expect(measured.text).toBe('');
    expect(measured.truncated).toBe(false);
  });
  it('finds fonts through Type0 descendants, descriptors, and font streams, preserving subset names', async () => {
    const fixture = embeddedFilesPdf();
    const inspector = new PdfInspector();
    const document = await inspector.open(fixture.bytes);
    const index = embeddedDownloads(
      new Map(
        document.objects.map((object) => {
          return [object.id, object];
        })
      )
    );
    for (const id of ['8 0', '9 0', '10 0', '11 0']) {
      expect(index.get(id)).toEqual([
        {
          filename: 'ABCDEF+Example.ttf',
          kind: 'font',
          streamId: '11 0',
          subset: true,
        },
      ]);
    }
    expect(inspector.readStream('11 0', 'decoded', 'download').bytes).toEqual(new Uint8Array(fixture.font));
  });
  it('does not export undecoded data or payloads above the decoding limit', async () => {
    const inspector = new PdfInspector();
    await inspector.open(
      classicPdf([
        [1, '<< /Type /Catalog /Pages 2 0 R >>'],
        [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
        [4, '<< /Length 3 /Filter /DCTDecode >>\nstream\nabc\nendstream'],
      ]).bytes
    );
    expect(inspector.readStream('4 0', 'decoded', 'download').error).toBeTruthy();
    await inspector.open(oversizedDecodedPdf().bytes);
    const result = inspector.readStream('4 0', 'decoded', 'download');
    expect(result.error).toMatch(/limit/i);
    expect(result.bytes).toHaveLength(0);
  });
  it('strips paths and unsafe control characters from suggested filenames', () => {
    expect(downloadFilename('../../evil.txt', 'fallback.bin')).toBe('evil.txt');
    expect(downloadFilename('C:\\folder\\font.ttf', 'fallback.bin')).toBe('font.ttf');
    expect(downloadFilename('  .. ', 'fallback.bin')).toBe('fallback.bin');
    expect(downloadFilename('report\u202etxt.exe', 'fallback.bin')).toBe('report_txt.exe');
  });
  it('names font files by their font file key and subtype', () => {
    const name = (value: string): PdfValue => {
      return { text: `/${value}`, type: 'name', value };
    };
    const record = (id: string, entries: [string, PdfValue][], stream = false): PdfObjectRecord => {
      return {
        generation: 0,
        id,
        kind: 'Dictionary',
        label: id,
        objectNumber: Number(id.split(' ')[0]),
        provenance: { reason: 'test', type: 'unknown' },
        referencedBy: [],
        references: [],
        source: '',
        ...(stream ? { stream: { filters: [], length: 0 } } : {}),
        value: {
          entries: entries.map(([key, value]) => {
            return { key, value };
          }),
          text: '<<>>',
          type: stream ? 'stream' : 'dictionary',
        },
        warnings: [],
      };
    };
    const cases: [string, string | undefined, string][] = [
      ['FontFile', undefined, 'type1'],
      ['FontFile2', 'OpenType', 'ttf'],
      ['FontFile3', 'OpenType', 'otf'],
      ['FontFile3', 'Type1C', 'cff'],
      ['FontFile3', 'CIDFontType0C', 'cff'],
      ['FontFile3', 'Type0', 'bin'],
      ['FontFile3', undefined, 'bin'],
    ];
    for (const [key, subtype, extension] of cases) {
      const objects = new Map([
        [
          '1 0',
          record('1 0', [
            ['FontName', name('Example')],
            [key, { ref: '2 0', text: '2 0 R', type: 'reference' }],
          ]),
        ],
        ['2 0', record('2 0', subtype ? [['Subtype', name(subtype)]] : [], true)],
      ]);
      expect(embeddedDownloads(objects).get('1 0')?.[0].filename).toBe(`Example.${extension}`);
    }
  });
});
