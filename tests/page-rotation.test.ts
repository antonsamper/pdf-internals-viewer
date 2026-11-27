import { describe, expect, it } from 'vitest';

// @ts-expect-error shared JavaScript fixture generator
import { classicPdf } from '../scripts/fixtures/pdf-fixtures.mjs';
import { PdfInspector } from '../src/lib/pdf/inspector';
import { pageRotationSummary } from '../src/lib/pdf/page-rotation';
const inspect = async function inspect(parent = '', first = '', second = '') {
  const document = await new PdfInspector().open(
    classicPdf([
      [1, '<< /Type /Catalog /Pages 2 0 R >>'],
      [2, `<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 ${parent} >>`],
      [3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] ${first} >>`],
      [4, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] ${second} >>`],
      [5, '-90'],
    ]).bytes
  );
  return {
    objects: new Map(
      document.objects.map((object) => {
        return [object.id, object];
      })
    ),
    pages: document.pages,
  };
};
describe('overview page rotation', () => {
  it.each([
    ['', '', '', '0°'],
    ['/Rotate 90', '', '', '90°'],
    ['/Rotate 180', '/Rotate 0', '', 'Mixed (0°, 180°)'],
    ['/Rotate 450', '/Rotate null', '', '90°'],
    ['', '/Rotate -90', '/Rotate 270', '270°'],
    ['/Rotate 5 0 R', '', '', '270°'],
    ['/Rotate 45', '', '', 'Unknown'],
    ['', '/Rotate (90)', '', 'Mixed (0°, Unknown)'],
    ['/Rotate 90', '/Rotate 99 0 R', '', 'Mixed (90°, Unknown)'],
  ])('summarizes parent %s and overrides %s / %s as %s', async (parent, first, second, expected) => {
    const { pages, objects } = await inspect(parent, first, second);
    expect(pageRotationSummary(pages, objects)).toBe(expected);
  });
  it('reports unavailable pages and broken or cyclic parent chains as unknown', async () => {
    const { pages, objects } = await inspect();
    expect(pageRotationSummary([], objects)).toBe('Not available');
    expect(pageRotationSummary(['missing'], objects)).toBe('Unknown');
    objects.delete('2 0');
    expect(pageRotationSummary(pages, objects)).toBe('Unknown');
    const page = objects.get('3 0')!;
    page.value = {
      entries: [
        {
          key: 'Parent',
          value: { ref: '3 0', text: '3 0 R', type: 'reference' },
        },
      ],
      text: '',
      type: 'dictionary',
    };
    expect(pageRotationSummary([page.id], objects)).toBe('Unknown');
    page.value.entries = [
      {
        key: 'Rotate',
        value: { ref: '3 0', text: '3 0 R', type: 'reference' },
      },
    ];
    expect(pageRotationSummary([page.id], objects)).toBe('Unknown');
  });
});
