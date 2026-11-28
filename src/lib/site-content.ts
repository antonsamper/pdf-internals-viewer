export const sitePage = function sitePage(pathname: string): SitePage | undefined {
  const path = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';

  return SITE_PAGES.find((page) => {
    return page.path === path;
  });
};

/** The index an article sits under: guides under the guide, examples under the examples. Other pages have none. */
export const articleSection = function articleSection(path: string) {
  if (path.startsWith('/guides/')) {
    return { href: '/guide', label: 'Guide' };
  }

  if (path.startsWith('/examples/')) {
    return { href: '/examples', label: 'Examples' };
  }

  return null;
};

/** Guides and examples are dated, authored articles; the other pages are plain web pages. */
export const isArticlePath = function isArticlePath(path: string) {
  return articleSection(path) !== null;
};

const articleDetails = function articleDetails(page: SitePage) {
  if (!isArticlePath(page.path)) {
    return {};
  }

  return {
    author: { '@id': `${SITE_URL}/#author` },
    dateModified: page.path.startsWith('/examples/') ? '2026-11-15' : '2026-11-14',
  };
};

/** The breadcrumb trail for every page except the home page, with the guide or examples index between home and an article. */
const breadcrumbs = function breadcrumbs(page: SitePage, url: string) {
  if (page.path === '/') {
    return [];
  }

  const section = articleSection(page.path);

  return [
    {
      '@id': `${url}#breadcrumbs`,
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          item: `${SITE_URL}/`,
          name: 'PDF Internals',
          position: 1,
        },
        ...(section ? [{ '@type': 'ListItem', item: `${SITE_URL}${section.href}`, name: section.label, position: 2 }] : []),
        {
          '@type': 'ListItem',
          item: url,
          name: page.heading,
          position: section ? 3 : 2,
        },
      ],
    },
  ];
};

export const structuredData = function structuredData(page: SitePage) {
  const url = SITE_URL + page.path;
  const author = {
    '@id': `${SITE_URL}/#author`,
    '@type': 'Person',
    name: 'Anton Samper',
    url: 'https://github.com/antonsamper',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': `${SITE_URL}/#website`,
        '@type': 'WebSite',
        name: 'PDF Internals',
        url: `${SITE_URL}/`,
      },
      author,
      {
        '@id': `${SITE_URL}/#application`,
        '@type': 'WebApplication',
        applicationCategory: 'DeveloperApplication',
        author: { '@id': author['@id'] },
        description: SITE_PAGES[0].description,
        isAccessibleForFree: true,
        name: 'PDF Internals',
        operatingSystem: 'Web browser',
        url: `${SITE_URL}/`,
      },
      {
        '@id': `${SITE_URL}/#source`,
        '@type': 'SoftwareSourceCode',
        codeRepository: PROJECT_URL,
        license: `${PROJECT_URL}/blob/main/LICENSE`,
        name: 'PDF Internals source code',
        targetProduct: { '@id': `${SITE_URL}/#application` },
      },
      {
        '@id': `${url}#page`,
        '@type': isArticlePath(page.path) ? 'TechArticle' : 'WebPage',
        about: { '@id': `${SITE_URL}/#application` },
        description: page.description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        name: page.title,
        url,
        ...articleDetails(page),
      },
      ...breadcrumbs(page, url),
    ],
  };
};

export const pageHead = function pageHead(page: SitePage) {
  const url = SITE_URL + page.path;
  const image = `${SITE_URL}/brand/pdf-internals-logo.png`;

  return `<title>${escapeHtml(page.title)}</title>
<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=8e7cb0ea" />
<meta name="description" content="${escapeHtml(page.description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="${isArticlePath(page.path) ? 'article' : 'website'}" />
<meta property="og:site_name" content="PDF Internals" />
<meta property="og:title" content="${escapeHtml(page.title)}" />
<meta property="og:description" content="${escapeHtml(page.description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:alt" content="PDF Internals — a detective exploring PDF structure" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(page.title)}" />
<meta name="twitter:description" content="${escapeHtml(page.description)}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json" id="site-schema">${JSON.stringify(structuredData(page)).replaceAll('<', '\\u003c')}</script>`;
};

/** Public identity and route inventory shared by the build and client navigation. */
export const SITE_URL = 'https://pdf-internals-viewer.pages.dev';
export const PROJECT_URL = 'https://github.com/antonsamper/pdf-internals-viewer';
export const PRIVACY_SUMMARY =
  'PDF processing and page rendering happen on your device. The app does not upload or save your PDF. Bookmarks and notes are saved in this browser and restored when you reopen the same PDF. Passwords are not saved.';
export const SITE_PAGES = [
  {
    description:
      'An open-source, read-only PDF inspector for developers. Explore objects, references, streams, and original bytes locally in your browser without uploading your PDF.',
    heading: 'Look inside a PDF.',
    path: '/',
    title: 'PDF Internals — Inspect PDF Objects, Streams & Hex',
  },
  {
    description: 'About PDF Internals, an open-source, read-only PDF exploration workspace that keeps files on your device.',
    heading: 'A closer look at PDF.',
    path: '/about',
    title: 'About · PDF Internals',
  },
  {
    description:
      'Explore how PDF developers, extraction engineers, QA teams and learners can use a local PDF inspector to investigate objects, fonts, streams and original bytes.',
    heading: 'Who is PDF Internals for?',
    path: '/who-its-for',
    title: 'Who Is a PDF Inspector For? · PDF Internals',
  },
  {
    description:
      'Learn when a normal PDF viewer is enough and when inspecting objects, references, streams and bytes helps explain file size, incorrect text and hidden resources.',
    heading: 'Why use a PDF inspector instead of a PDF viewer?',
    path: '/pdf-inspector-vs-viewer',
    title: 'PDF Inspector vs PDF Viewer: When to Use Each · PDF Internals',
  },
  {
    description:
      'Start with a sample PDF, then explore task guides for objects, streams, resources, attachments, search, and suspicious features.',
    heading: 'How to inspect a PDF in your browser',
    path: '/guide',
    title: 'How to Inspect a PDF in Your Browser · PDF Internals',
  },
  {
    description:
      'Understand indirect PDF objects and references with a reproducible example. Follow a page to its content stream and inspect its original bytes.',
    heading: 'PDF objects and references: what does 3 0 R mean?',
    path: '/guides/inspect-pdf-objects',
    title: 'PDF Objects and References: What Does 3 0 R Mean? · PDF Internals',
  },
  {
    description:
      'A guide to decoding PDF streams and searching their drawing instructions, with examples of split words, spacing adjustments and compressed object streams.',
    heading: 'How to inspect and decode PDF streams',
    path: '/guides/decode-pdf-streams',
    title: 'How to Inspect and Decode PDF Streams · PDF Internals',
  },
  {
    description:
      'Inspect PDF font and image resources, follow inherited references, and understand embedded font and image extraction limits without uploading your PDF.',
    heading: 'How to find fonts and images in a PDF',
    path: '/guides/find-pdf-fonts-images',
    title: 'How to Find Fonts and Images in a PDF · PDF Internals',
  },
  {
    description:
      'Locate embedded files, follow file specifications, and download supported attachments while understanding indexing and decoding limits.',
    heading: 'Find and extract PDF attachments',
    path: '/guides/find-pdf-attachments',
    title: 'Find and extract PDF attachments · PDF Internals',
  },
  {
    description: 'Choose a search mode, save findings with notes, and compare dictionary values without changing your PDF.',
    heading: 'Search, bookmark, and compare PDF objects',
    path: '/guides/search-bookmark-compare',
    title: 'Search, bookmark, and compare PDF objects · PDF Internals',
  },
  {
    description:
      'Find JavaScript, automatic actions, launch actions, and embedded files. Follow references and interpret results without treating an empty search as proof of safety.',
    heading: 'Investigate suspicious PDF features',
    path: '/guides/investigate-suspicious-features',
    title: 'Investigate suspicious PDF features · PDF Internals',
  },
  {
    description:
      'Ten PDF investigations covering structural errors, file size, text mappings, searching text to its source bytes, fonts, attachments, repeated images, rotation, inherited resources, and opening actions.',
    heading: 'PDF debugging examples',
    path: '/examples',
    title: 'PDF Debugging Examples · PDF Internals',
  },
  {
    description: "Follow an invoice's image resource to find 4,320,000 bytes of uncompressed pixels, then inspect how the page draws it.",
    heading: 'Why is this one-page PDF so large?',
    path: '/examples/large-pdf',
    title: 'Why Is This One-page PDF So Large? · PDF Internals',
  },
  {
    description:
      "Inspect an invoice's content stream, font and deliberately incorrect ToUnicode mapping to explain a changed amount in extracted text.",
    heading: 'Why does copied PDF text differ from the page?',
    path: '/examples/incorrect-text',
    title: 'Why Does Copied PDF Text Differ from the Page? · PDF Internals',
  },
  {
    description:
      'Follow a text instruction to its font descriptor and embedded TrueType program. Compare it with a font that is named but not embedded.',
    heading: 'Which font is this PDF actually using?',
    path: '/examples/embedded-font',
    title: 'Which font is this PDF actually using? · PDF Internals',
  },
  {
    description:
      'Search a PDF’s page text, find the match in the preview, then follow it to the decoded content stream bytes and character codes that draw it.',
    heading: 'How to find the source bytes behind text in a PDF',
    path: '/examples/find-text-source',
    title: 'How to Find the Source Bytes Behind Text in a PDF · PDF Internals',
  },
  {
    description: 'Find an invoice’s CSV attachment, follow its file specification, and download the data that does not appear on the page.',
    heading: 'Where is the attachment?',
    path: '/examples/hidden-attachment',
    title: 'Where is the attachment? · PDF Internals',
  },
  {
    description: 'Compare three pages’ image references to distinguish shared artwork from a separate copy of the same logo.',
    heading: 'Why is the same logo stored several times?',
    path: '/examples/repeated-logo',
    title: 'Why is the same logo stored several times? · PDF Internals',
  },
  {
    description: 'Trace inherited page rotation and compare it with a drawing matrix that turns text on a page with zero page rotation.',
    heading: 'Why is this page rotated?',
    path: '/examples/page-rotation',
    title: 'Why is this page rotated? · PDF Internals',
  },
  {
    description: 'Follow a page’s parent to find the inherited font and image resources missing from its own dictionary.',
    heading: 'Where did this page’s resources come from?',
    path: '/examples/inherited-resources',
    title: 'Where did this page’s resources come from? · PDF Internals',
  },
  {
    description:
      'Learn what PDF actions do, how OpenAction and other triggers work, and inspect a GoTo opening action in a downloadable example.',
    heading: 'PDF actions: types and an automatic opening example',
    path: '/examples/opening-action',
    title: 'PDF actions explained: types and OpenAction example · PDF Internals',
  },
  {
    description:
      'Open a deliberately damaged PDF, see its invalid cross-reference error and unresolved reference warning, and trace both to the original bytes.',
    heading: 'What does a PDF error look like?',
    path: '/examples/broken-xref',
    title: 'What does a PDF error look like? · PDF Internals',
  },
  {
    description:
      'PDFs are processed locally without uploads. Learn what PDF Internals stores in your browser, how bookmarks work, and how to delete saved notes.',
    heading: 'Your PDFs and browser storage',
    path: '/privacy',
    title: 'Privacy and Browser Storage · PDF Internals',
  },
  {
    description:
      'PDF Internals file limits, stream decoding support, encrypted PDF behaviour, export restrictions, browser coverage, and limits on preserving exact file syntax.',
    heading: 'Supported features and limitations',
    path: '/limitations',
    title: 'Supported Features and Limitations · PDF Internals',
  },
] as const;
export type SitePath = (typeof SITE_PAGES)[number]['path'];
export type SitePage = (typeof SITE_PAGES)[number];
export const SAMPLES = [
  {
    detail: 'Catalogue, page tree, font, and drawing instructions',
    file: 'minimal.pdf',
    id: 'minimal',
    name: 'A simple page',
    tone: 'purple',
  },
  {
    detail: 'Explore page resources and their references',
    file: 'resources.pdf',
    id: 'resources',
    name: 'Fonts & resources',
    tone: 'red',
  },
  {
    detail: 'Find objects packed into a compressed stream',
    file: 'compressed.pdf',
    id: 'compressed',
    name: 'Compressed objects',
    tone: 'orange',
  },
] as const;
/** Walkthrough samples are allowlisted, without expanding the starter sample list. */
export const EXAMPLE_SAMPLES = [
  {
    file: 'oversized-image.pdf',
    id: 'oversized-image',
    name: 'An oversized image',
  },
  {
    file: 'incorrect-unicode.pdf',
    id: 'incorrect-unicode',
    name: 'An incorrect text mapping',
  },
  {
    file: 'find-text-source.pdf',
    id: 'find-text-source',
    name: 'Finding the bytes behind text',
  },
  {
    file: 'embedded-font.pdf',
    id: 'embedded-font',
    name: 'Which font is this PDF actually using?',
  },
  {
    file: 'hidden-attachment.pdf',
    id: 'hidden-attachment',
    name: 'Where is the attachment?',
  },
  {
    file: 'repeated-logo.pdf',
    id: 'repeated-logo',
    name: 'Why is the same logo stored several times?',
  },
  {
    file: 'page-rotation.pdf',
    id: 'page-rotation',
    name: 'Why is this page rotated?',
  },
  {
    file: 'inherited-resources.pdf',
    id: 'inherited-resources',
    name: 'Where did this page’s resources come from?',
  },
  {
    file: 'opening-action.pdf',
    id: 'opening-action',
    name: 'Does this PDF contain an automatic action?',
  },
  {
    file: 'broken-xref.pdf',
    id: 'broken-xref',
    name: 'A broken cross-reference',
  },
] as const;
export const ALL_SAMPLES = [...SAMPLES, ...EXAMPLE_SAMPLES];
const escapeHtml = (value: string) => {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
};
