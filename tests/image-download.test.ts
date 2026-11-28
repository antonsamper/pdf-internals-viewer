import { expect, it } from 'vitest';

// @ts-expect-error shared JavaScript fixtures
import { imageExportPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { imageDownloadPlan } from '../src/lib/pdf/image-download';
import { PdfInspector } from '../src/lib/pdf/inspector';
import { imageRgba } from '../src/lib/pdf/resource-tools';

it('exports full PNG samples beyond the thumbnail preview limit', async () => {
  const fixture = imageExportPdf();
  const inspector = new PdfInspector();
  const document = await inspector.open(fixture.bytes);
  const object = document.objects.find((candidate) => {
    return candidate.id === '6 0';
  })!;
  const plan = imageDownloadPlan(object);

  expect(plan.format).toBe('png');
  expect(inspector.readStream(object.id, 'decoded').truncated).toBe(true);
  const result = inspector.readStream(object.id, 'decoded', 'image');

  expect(result.error).toBeUndefined();
  expect(result.truncated).toBe(false);
  expect(result.bytes).toEqual(new Uint8Array(fixture.pixels));
  if (plan.format === 'png') {
    expect(Array.from(imageRgba(plan.pixels, result.bytes).slice(-4))).toEqual([32, 117, 214, 255]);
  }
});

it('preserves JPEG bytes explicitly, without relabeling decoded inspection as supported', async () => {
  const jpeg = Buffer.from([255, 216, 255, 217]);
  const inspector = new PdfInspector();
  const doc = await inspector.open(imageExportPdf({ data: jpeg, filter: 'DCTDecode', height: 1, width: 1 }).bytes);
  const object = doc.objects.find((candidate) => {
    return candidate.id === '6 0';
  })!;

  expect(imageDownloadPlan(object)).toEqual({
    filename: 'image-6-0.jpg',
    format: 'jpeg',
  });
  expect(inspector.readStream(object.id, 'decoded').error).toMatch(/DCTDecode/);
  expect(inspector.readStream(object.id, 'decoded', 'download').error).toMatch(/DCTDecode/);
  const result = inspector.readStream(object.id, 'decoded', 'image');

  expect(result.error).toBeUndefined();
  expect(result.encoding).toBe('jpeg');
  expect(result.bytes).toEqual(new Uint8Array(jpeg));
  expect(inspector.readStream('4 0', 'decoded', 'image').error).toMatch(/not an image/);
});

it('rejects unsupported formats, masks, and excessive PNG dimensions', async () => {
  for (const options of [{ data: Buffer.from([0]), filter: 'JPXDecode' }, { extra: '/SMask 7 0 R' }, { height: 1, width: 5000 }]) {
    const doc = await new PdfInspector().open(imageExportPdf(options).bytes);

    expect(() => {
      return imageDownloadPlan(
        doc.objects.find((candidate) => {
          return candidate.id === '6 0';
        })!
      );
    }).toThrow(/unavailable/);
  }
});
