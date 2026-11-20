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
    path: "/guide",
    title: "How to Inspect a PDF in Your Browser · PDF Internals",
    heading: "How to inspect a PDF in your browser",
    description:
      "Follow a PDF page to its objects, drawing instructions, and original bytes with the local PDF Internals inspector and original sample files.",
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
        "@type": page.path.startsWith("/guides/") ? "TechArticle" : "WebPage",
        "@id": `${url}#page`,
        url,
        name: page.title,
        description: page.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#application` },
        ...(page.path.startsWith("/guides/")
          ? { author: { "@id": author["@id"] }, dateModified: "2026-11-14" }
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
                ...(page.path.startsWith("/guides/")
                  ? [
                      {
                        "@type": "ListItem",
                        position: 2,
                        name: "Guide",
                        item: `${SITE_URL}/guide`,
                      },
                    ]
                  : []),
                {
                  "@type": "ListItem",
                  position: page.path.startsWith("/guides/") ? 3 : 2,
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
<meta property="og:type" content="${page.path.startsWith("/guides/") ? "article" : "website"}" />
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
