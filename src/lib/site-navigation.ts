import { SITE_PAGES, type SitePath } from './site-content';
export const navigationLabel = function navigationLabel(path: SitePath) {
  return CONTENT_GROUPS.flatMap((group) => group.items).find(([href]) => href === path)?.[1] ?? 'PDF Internals';
};
export const relatedPages = function relatedPages(path: SitePath) {
  return (RELATED[path] ?? []).map((href) => SITE_PAGES.find((page) => page.path === href)!);
};
export const contentType = function contentType(path: SitePath) {
  return CONTENT_GROUPS.find((group) => group.items.some(([href]) => href === path))?.label.replace(/s$/, '') ?? 'Overview';
};
export const CONTENT_GROUPS: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<readonly [SitePath, string]>;
}> = [
  {
    items: [
      ['/about', 'About'],
      ['/who-its-for', 'Who it’s for'],
      ['/pdf-inspector-vs-viewer', 'Inspector vs viewer'],
    ],
    label: 'Overview',
  },
  {
    items: [
      ['/guide', 'Getting started'],
      ['/guides/inspect-pdf-objects', 'Objects and references'],
      ['/guides/decode-pdf-streams', 'Streams'],
      ['/guides/find-pdf-fonts-images', 'Fonts and images'],
      ['/guides/find-pdf-attachments', 'Attachments'],
      ['/guides/search-bookmark-compare', 'Search and comparison'],
      ['/guides/investigate-suspicious-features', 'Suspicious features'],
    ],
    label: 'Guides',
  },
  {
    items: [
      ['/examples', 'All examples'],
      ['/examples/broken-xref', 'A PDF with an error'],
      ['/examples/large-pdf', 'An unexpectedly large PDF'],
      ['/examples/incorrect-text', 'Incorrect copied text'],
      ['/examples/find-text-source', 'Source bytes behind text'],
      ['/examples/embedded-font', 'Embedded fonts'],
      ['/examples/hidden-attachment', 'A hidden attachment'],
      ['/examples/repeated-logo', 'Repeated logos'],
      ['/examples/page-rotation', 'Page rotation'],
      ['/examples/inherited-resources', 'Inherited resources'],
      ['/examples/opening-action', 'PDF actions and OpenAction'],
    ],
    label: 'Examples',
  },
  {
    items: [
      ['/privacy', 'Privacy'],
      ['/limitations', 'Supported features and limitations'],
    ],
    label: 'Reference',
  },
];
const RELATED: Partial<Record<SitePath, readonly SitePath[]>> = {
  '/about': ['/who-its-for', '/pdf-inspector-vs-viewer', '/guide'],
  '/examples': ['/guide', '/who-its-for', '/pdf-inspector-vs-viewer'],
  '/examples/broken-xref': ['/guides/inspect-pdf-objects', '/guides/search-bookmark-compare', '/limitations'],
  '/examples/embedded-font': ['/guides/find-pdf-fonts-images', '/examples/incorrect-text', '/limitations'],
  '/examples/find-text-source': ['/guides/search-bookmark-compare', '/examples/incorrect-text', '/limitations'],
  '/examples/hidden-attachment': ['/guides/find-pdf-attachments', '/examples/opening-action', '/guides/investigate-suspicious-features'],
  '/examples/incorrect-text': ['/guides/find-pdf-fonts-images', '/examples/embedded-font', '/guides/decode-pdf-streams'],
  '/examples/inherited-resources': ['/guides/find-pdf-fonts-images', '/examples/page-rotation', '/guides/inspect-pdf-objects'],
  '/examples/large-pdf': ['/guides/find-pdf-fonts-images', '/examples/repeated-logo', '/guides/decode-pdf-streams'],
  '/examples/opening-action': ['/guides/investigate-suspicious-features', '/examples/hidden-attachment', '/limitations'],
  '/examples/page-rotation': ['/guides/inspect-pdf-objects', '/examples/inherited-resources', '/guides/decode-pdf-streams'],
  '/examples/repeated-logo': ['/guides/search-bookmark-compare', '/examples/large-pdf', '/guides/find-pdf-fonts-images'],
  '/guide': ['/guides/inspect-pdf-objects', '/examples/large-pdf', '/examples/incorrect-text'],
  '/guides/decode-pdf-streams': ['/guides/inspect-pdf-objects', '/examples/incorrect-text', '/limitations'],
  '/guides/find-pdf-attachments': ['/examples/hidden-attachment', '/guides/investigate-suspicious-features', '/limitations'],
  '/guides/find-pdf-fonts-images': ['/examples/embedded-font', '/examples/large-pdf', '/examples/repeated-logo'],
  '/guides/inspect-pdf-objects': ['/guides/decode-pdf-streams', '/examples/inherited-resources', '/guides/find-pdf-fonts-images'],
  '/guides/investigate-suspicious-features': ['/examples/opening-action', '/examples/hidden-attachment', '/limitations'],
  '/guides/search-bookmark-compare': ['/examples/find-text-source', '/guides/inspect-pdf-objects', '/privacy'],
  '/limitations': ['/privacy', '/guide', '/guides/investigate-suspicious-features'],
  '/pdf-inspector-vs-viewer': ['/examples/incorrect-text', '/guides/inspect-pdf-objects', '/limitations'],
  '/privacy': ['/limitations', '/guides/search-bookmark-compare', '/guide'],
  '/who-its-for': ['/pdf-inspector-vs-viewer', '/guide', '/examples'],
};
