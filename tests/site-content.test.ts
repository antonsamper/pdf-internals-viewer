import { describe, expect, it } from 'vitest';

import { SITE_URL, sitePage, structuredData } from '../src/lib/site-content';

const graph = (path: string) => structuredData(sitePage(path)!)['@graph'] as Array<Record<string, unknown>>;
const node = (path: string, type: string) => graph(path).find((item) => item['@type'] === type);
const trail = (path: string) =>
  (node(path, 'BreadcrumbList')!.itemListElement as Array<{ item: string; name: string; position: number }>).map(
    ({ item, name, position }) => [position, name, item]
  );

describe('public page structured data', () => {
  it('describes the home page as a web page without breadcrumbs', () => {
    expect(node('/', 'WebPage')).toMatchObject({ '@id': `${SITE_URL}/#page`, name: sitePage('/')!.title });
    expect(node('/', 'BreadcrumbList')).toBeUndefined();
  });

  it('gives overview pages a two-step breadcrumb and no article details', () => {
    const page = node('/who-its-for', 'WebPage');
    expect(page).not.toHaveProperty('author');
    expect(page).not.toHaveProperty('dateModified');
    expect(trail('/who-its-for')).toEqual([
      [1, 'PDF Internals', `${SITE_URL}/`],
      [2, sitePage('/who-its-for')!.heading, `${SITE_URL}/who-its-for`],
    ]);
  });

  it('marks guides as authored articles under the guide', () => {
    expect(node('/guides/decode-pdf-streams', 'TechArticle')).toMatchObject({
      author: { '@id': `${SITE_URL}/#author` },
      dateModified: '2026-11-14',
    });
    expect(trail('/guides/decode-pdf-streams')).toEqual([
      [1, 'PDF Internals', `${SITE_URL}/`],
      [2, 'Guide', `${SITE_URL}/guide`],
      [3, sitePage('/guides/decode-pdf-streams')!.heading, `${SITE_URL}/guides/decode-pdf-streams`],
    ]);
  });

  it('marks examples as authored articles under the examples', () => {
    expect(node('/examples/large-pdf', 'TechArticle')).toMatchObject({ dateModified: '2026-11-15' });
    expect(trail('/examples/large-pdf')[1]).toEqual([2, 'Examples', `${SITE_URL}/examples`]);
  });
});
