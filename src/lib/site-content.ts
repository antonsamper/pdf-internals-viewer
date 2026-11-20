/** Public identity and route inventory shared by the build and client navigation. */
export const SITE_URL = "https://pdf-internals-viewer.pages.dev"
export const PROJECT_URL = "https://github.com/antonsamper/pdf-internals-viewer"
export const PRIVACY_SUMMARY =
  "PDF processing and page rendering happen on your device. The app does not upload or save your PDF. Bookmarks and notes are saved in this browser and restored when you reopen the same PDF. Passwords are not saved."

export const SITE_PAGES = [
  {
    path: "/",
    title: "PDF Internals — Inspect PDF Objects, Streams & Hex",
    heading: "Look inside a PDF.",
    description:
      "An open-source, read-only PDF inspector for developers. Explore objects, references, streams, and original bytes locally in your browser without uploading your PDF.",
  },
  {
    path: "/about",
    title: "About · PDF Internals",
    heading: "A closer look at PDF.",
    description:
      "About PDF Internals, an open-source, read-only PDF exploration workspace that keeps files on your device.",
  },
  {
    path: "/who-its-for",
    title: "Who Is a PDF Inspector For? · PDF Internals",
    heading: "Who is PDF Internals for?",
    description:
      "Explore how PDF developers, extraction engineers, QA teams and learners can use a local PDF inspector to investigate objects, fonts, streams and original bytes.",
  },
  {
    path: "/pdf-inspector-vs-viewer",
    title: "PDF Inspector vs PDF Viewer: When to Use Each · PDF Internals",
    heading: "Why use a PDF inspector instead of a PDF viewer?",
    description:
      "Learn when a normal PDF viewer is enough and when inspecting objects, references, streams and bytes helps explain file size, incorrect text and hidden resources.",
  },
  {
    path: "/guide",
    title: "How to Inspect a PDF in Your Browser · PDF Internals",
    heading: "How to inspect a PDF in your browser",
    description:
      "Start with a sample PDF, then explore task guides for objects, streams, resources, attachments, search, and suspicious features.",
  },
  {
    path: "/guides/inspect-pdf-objects",
    title: "PDF Objects and References: What Does 3 0 R Mean? · PDF Internals",
    heading: "PDF objects and references: what does 3 0 R mean?",
    description:
      "Understand indirect PDF objects and references with a reproducible example. Follow a page to its content stream and inspect its original bytes.",
  },
  {
    path: "/guides/decode-pdf-streams",
    title: "How to Inspect and Decode PDF Streams · PDF Internals",
    heading: "How to inspect and decode PDF streams",
    description:
      "Compare raw and decoded PDF streams, inspect FlateDecode drawing instructions, and understand compressed object streams using original samples.",
  },
  {
    path: "/guides/find-pdf-fonts-images",
    title: "How to Find Fonts and Images in a PDF · PDF Internals",
    heading: "How to find fonts and images in a PDF",
    description:
      "Inspect PDF font and image resources, follow inherited references, and understand embedded font and image extraction limits without uploading your PDF.",
  },
  {
    path: "/guides/find-pdf-attachments",
    title: "Find and extract PDF attachments · PDF Internals",
    heading: "Find and extract PDF attachments",
    description:
      "Locate embedded files, follow file specifications, and download supported attachments while understanding indexing and decoding limits.",
  },
  {
    path: "/guides/search-bookmark-compare",
    title: "Search, bookmark, and compare PDF objects · PDF Internals",
    heading: "Search, bookmark, and compare PDF objects",
    description:
      "Choose a search mode, save findings with notes, and compare dictionary values without changing your PDF.",
  },
  {
    path: "/guides/investigate-suspicious-features",
    title: "Investigate suspicious PDF features · PDF Internals",
    heading: "Investigate suspicious PDF features",
    description:
      "Find JavaScript, automatic actions, launch actions, and embedded files. Follow references and interpret results without treating an empty search as proof of safety.",
  },
  {
    path: "/examples",
    title: "PDF Debugging Examples · PDF Internals",
    heading: "PDF debugging examples",
    description:
      "Nine worked PDF investigations covering structural errors, file size, text mappings, fonts, attachments, repeated images, rotation, inherited resources, and opening actions.",
  },
  {
    path: "/examples/large-pdf",
    title: "Why Is This One-page PDF So Large? · PDF Internals",
    heading: "Why is this one-page PDF so large?",
    description:
      "Follow an invoice's image resource to find 4,320,000 bytes of uncompressed pixels, then inspect how the page draws it.",
  },
  {
    path: "/examples/incorrect-text",
    title: "Why Does Copied PDF Text Differ from the Page? · PDF Internals",
    heading: "Why does copied PDF text differ from the page?",
    description:
      "Inspect an invoice's content stream, font and deliberately incorrect ToUnicode mapping to explain a changed amount in extracted text.",
  },
  {
    path: "/examples/embedded-font",
    title: "Which font is this PDF actually using? · PDF Internals",
    heading: "Which font is this PDF actually using?",
    description:
      "Follow a text instruction to its font descriptor and embedded TrueType program. Compare it with a font that is named but not embedded.",
  },
  {
    path: "/examples/hidden-attachment",
    title: "Where is the attachment? · PDF Internals",
    heading: "Where is the attachment?",
    description:
      "Find an invoice’s CSV attachment, follow its file specification, and download the data that does not appear on the page.",
  },
  {
    path: "/examples/repeated-logo",
    title: "Why is the same logo stored several times? · PDF Internals",
    heading: "Why is the same logo stored several times?",
    description:
      "Compare three pages’ image references to distinguish shared artwork from a separate copy of the same logo.",
  },
  {
    path: "/examples/page-rotation",
    title: "Why is this page rotated? · PDF Internals",
    heading: "Why is this page rotated?",
    description:
      "Trace inherited page rotation and compare it with a drawing matrix that turns text on a page with zero page rotation.",
  },
  {
    path: "/examples/inherited-resources",
    title: "Where did this page’s resources come from? · PDF Internals",
    heading: "Where did this page’s resources come from?",
    description:
      "Follow a page’s parent to find the inherited font and image resources missing from its own dictionary.",
  },
  {
    path: "/examples/opening-action",
    title: "Does this PDF contain an automatic action? · PDF Internals",
    heading: "Does this PDF contain an automatic action?",
    description:
      "Inspect a catalogue’s OpenAction reference and follow a local GoTo destination to the first page.",
  },
  {
    path: "/examples/broken-xref",
    title: "What does a PDF error look like? · PDF Internals",
    heading: "What does a PDF error look like?",
    description:
      "Open a deliberately damaged PDF, see its invalid cross-reference error and unresolved reference warning, and trace both to the original bytes.",
  },
  {
    path: "/privacy",
    title: "Privacy and Browser Storage · PDF Internals",
    heading: "Your PDFs and browser storage",
    description:
      "PDFs are processed locally without uploads. Learn what PDF Internals stores in your browser, how bookmarks work, and how to delete saved notes.",
  },
  {
    path: "/limitations",
    title: "Supported Features and Limitations · PDF Internals",
    heading: "Supported features and limitations",
    description:
      "PDF Internals file limits, stream decoding support, encrypted PDF behaviour, export restrictions, browser coverage, and limits on preserving exact file syntax.",
  },
] as const
export type SitePath = (typeof SITE_PAGES)[number]["path"]
export type SitePage = (typeof SITE_PAGES)[number]
export function sitePage(pathname: string): SitePage | undefined {
  const path = pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/"
  return SITE_PAGES.find((page) => page.path === path)
}

export const SAMPLES = [
  {
    id: "minimal",
    file: "minimal.pdf",
    name: "A simple page",
    detail: "Catalogue, page tree, font, and drawing instructions",
    tone: "purple",
  },
  {
    id: "resources",
    file: "resources.pdf",
    name: "Fonts & resources",
    detail: "Explore page resources and their references",
    tone: "red",
  },
  {
    id: "compressed",
    file: "compressed.pdf",
    name: "Compressed objects",
    detail: "Find objects packed into a compressed stream",
    tone: "orange",
  },
] as const

/** Walkthrough samples are allowlisted, without expanding the starter sample list. */
export const EXAMPLE_SAMPLES = [
  {
    id: "oversized-image",
    file: "oversized-image.pdf",
    name: "An oversized image",
  },
  {
    id: "incorrect-unicode",
    file: "incorrect-unicode.pdf",
    name: "An incorrect text mapping",
  },
  {
    id: "embedded-font",
    file: "embedded-font.pdf",
    name: "Which font is this PDF actually using?",
  },
  {
    id: "hidden-attachment",
    file: "hidden-attachment.pdf",
    name: "Where is the attachment?",
  },
  {
    id: "repeated-logo",
    file: "repeated-logo.pdf",
    name: "Why is the same logo stored several times?",
  },
  {
    id: "page-rotation",
    file: "page-rotation.pdf",
    name: "Why is this page rotated?",
  },
  {
    id: "inherited-resources",
    file: "inherited-resources.pdf",
    name: "Where did this page’s resources come from?",
  },
  {
    id: "opening-action",
    file: "opening-action.pdf",
    name: "Does this PDF contain an automatic action?",
  },
  {
    id: "broken-xref",
    file: "broken-xref.pdf",
    name: "A broken cross-reference",
  },
] as const
export const ALL_SAMPLES = [...SAMPLES, ...EXAMPLE_SAMPLES]

export function structuredData(page: SitePage) {
  const url = SITE_URL + page.path
  const author = {
    "@type": "Person",
    "@id": `${SITE_URL}/#author`,
    name: "Anton Samper",
    url: "https://github.com/antonsamper",
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "PDF Internals",
        url: `${SITE_URL}/`,
      },
      author,
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#application`,
        name: "PDF Internals",
        url: `${SITE_URL}/`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web browser",
        description: SITE_PAGES[0].description,
        author: { "@id": author["@id"] },
        isAccessibleForFree: true,
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${SITE_URL}/#source`,
        name: "PDF Internals source code",
        codeRepository: PROJECT_URL,
        license: `${PROJECT_URL}/blob/main/LICENSE`,
        targetProduct: { "@id": `${SITE_URL}/#application` },
      },
      {
        "@type":
          page.path.startsWith("/guides/") || page.path.startsWith("/examples/")
            ? "TechArticle"
            : "WebPage",
        "@id": `${url}#page`,
        url,
        name: page.title,
        description: page.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#application` },
        ...(page.path.startsWith("/guides/") ||
        page.path.startsWith("/examples/")
          ? {
              author: { "@id": author["@id"] },
              dateModified: page.path.startsWith("/examples/")
                ? "2026-11-15"
                : "2026-11-14",
            }
          : {}),
      },
      ...(page.path === "/"
        ? []
        : [
            {
              "@type": "BreadcrumbList",
              "@id": `${url}#breadcrumbs`,
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "PDF Internals",
                  item: `${SITE_URL}/`,
                },
                ...(page.path.startsWith("/guides/") ||
                page.path.startsWith("/examples/")
                  ? [
                      {
                        "@type": "ListItem",
                        position: 2,
                        name: page.path.startsWith("/examples/")
                          ? "Examples"
                          : "Guide",
                        item: `${SITE_URL}${page.path.startsWith("/examples/") ? "/examples" : "/guide"}`,
                      },
                    ]
                  : []),
                {
                  "@type": "ListItem",
                  position:
                    page.path.startsWith("/guides/") ||
                    page.path.startsWith("/examples/")
                      ? 3
                      : 2,
                  name: page.heading,
                  item: url,
                },
              ],
            },
          ]),
    ],
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
export function pageHead(page: SitePage) {
  const url = SITE_URL + page.path
  const image = `${SITE_URL}/brand/pdf-internals-logo.png`
  return `<title>${escapeHtml(page.title)}</title>
<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=8e7cb0ea" />
<meta name="description" content="${escapeHtml(page.description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="${page.path.startsWith("/guides/") || page.path.startsWith("/examples/") ? "article" : "website"}" />
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
<script type="application/ld+json" id="site-schema">${JSON.stringify(structuredData(page)).replaceAll("<", "\\u003c")}</script>`
}
