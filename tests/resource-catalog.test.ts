import { expect, it } from 'vitest';

// @ts-expect-error shared JavaScript fixture generator
import { embeddedFilesPdf, classicPdf, minimalPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { PdfInspector } from '../src/lib/pdf/inspector';
import { resourceCatalog } from '../src/lib/pdf/resource-catalog';

it('lists named attachments once and exposes downloads on font entries', async () => {
  const doc = await new PdfInspector().open(embeddedFilesPdf().bytes);
  const entries = resourceCatalog(
    new Map(
      doc.objects.map((object) => {
        return [object.id, object];
      })
    )
  );
  const attachments = entries.filter((entry) => {
    return entry.kind === 'Attachment';
  });

  expect(attachments).toHaveLength(1);
  expect(attachments[0].object.id).toBe('6 0');
  expect(
    attachments[0].downloads.map((asset) => {
      return asset.filename;
    })
  ).toEqual(['report.txt']);
  expect(
    entries
      .filter((entry) => {
        return entry.kind === 'Font';
      })
      .every((entry) => {
        return entry.downloads[0].subset;
      })
  ).toBe(true);
});

it('includes embedded file streams without named file specifications', async () => {
  const fixture = classicPdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
    [4, '<< /Type /EmbeddedFile /Length 3 >>\nstream\nabc\nendstream'],
  ]);
  const doc = await new PdfInspector().open(fixture.bytes);
  const entries = resourceCatalog(
    new Map(
      doc.objects.map((object) => {
        return [object.id, object];
      })
    )
  );

  expect(entries).toHaveLength(1);
  expect(entries[0].kind).toBe('Attachment');
  expect(entries[0].downloads[0].filename).toBe('attachment-4-0.bin');
});

it('retains fonts without downloadable embedded programs', async () => {
  const doc = await new PdfInspector().open(minimalPdf().bytes);
  const fonts = resourceCatalog(
    new Map(
      doc.objects.map((object) => {
        return [object.id, object];
      })
    )
  ).filter((entry) => {
    return entry.kind === 'Font';
  });

  expect(fonts).toHaveLength(1);
  expect(fonts[0].downloads).toEqual([]);
});

it.each([
  '/Names << /EmbeddedFiles << /Names [(inline.txt) << /Type /Filespec /F (inline.txt) /EF << /F 4 0 R >> >>] >> >>',
  '/AF [<< /Type /Filespec /UF (inline.txt) /EF << /UF 4 0 R >> >>]',
  '/Annots [<< /Subtype /FileAttachment /FS << /F (inline.txt) /EF << /F 4 0 R >> >> >>]',
])('finds a nested direct file specification without an EmbeddedFile type: %s', async (nested) => {
  const fixture = classicPdf([
    [1, `<< /Type /Catalog /Pages 2 0 R ${nested} >>`],
    [2, '<< /Type /Pages /Kids [] /Count 0 >>'],
    [4, '<< /Length 3 >>\nstream\nabc\nendstream'],
  ]);
  const doc = await new PdfInspector().open(fixture.bytes);
  const entries = resourceCatalog(
    new Map(
      doc.objects.map((object) => {
        return [object.id, object];
      })
    )
  );

  expect(entries).toHaveLength(1);
  expect(entries[0].kind).toBe('Attachment');
  expect(entries[0].downloads).toEqual([
    {
      filename: 'inline.txt',
      kind: 'attachment',
      streamId: '4 0',
      subset: false,
    },
  ]);
});
