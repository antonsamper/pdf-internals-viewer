# Public content and samples

Besides the inspector, the site has an About page, overview pages, task guides, examples, and privacy and limitations pages. They are rendered to static HTML at build time and work without JavaScript.

## Where the content lives

| File | Contents |
| --- | --- |
| `src/lib/site-content.ts` | `SITE_PAGES` (every route with its title and description), page metadata and structured data, and the sample allowlists `SAMPLES` and `EXAMPLE_SAMPLES` |
| `src/lib/site-navigation.ts` | `CONTENT_GROUPS` (navigation groups and labels) and the three related pages for each route |
| `src/content/public-page.tsx` | The article shell, `/guide`, the objects, streams and fonts guides, `/privacy` and `/limitations` |
| `src/content/task-guides.tsx` | The attachments, search and suspicious-features guides |
| `src/content/overview-pages.tsx` | `/who-its-for` and `/pdf-inspector-vs-viewer` |
| `src/content/examples.tsx`, `more-examples.tsx` | `/examples` and the ten examples |
| `src/components/about-page.tsx` | The About page |

## Adding a page

1. Add the route to `SITE_PAGES`.
2. Give it a label in `CONTENT_GROUPS` and three related pages in `site-navigation.ts`.
3. Render it from `public-page.tsx`.
4. Update the sitemap URL count asserted in `scripts/check-public-pages.mjs`.

`pnpm run build` prerenders every route (`scripts/prerender.mjs`) and generates `sitemap.xml`. `/` and `/about` are hydrated by the app, so their first render must not use browser APIs; read browser state in effects. Every other route is static HTML with no app JavaScript. After each build, `check:public-pages` checks the metadata, structured data, navigation and links of every page.

Guides and examples show a "Reviewed" date and a `dateModified` value. Change them only after checking the content against the current app.

## Samples

`/?sample=<id>` opens a bundled sample. Only IDs in `SAMPLES` or `EXAMPLE_SAMPLES` are accepted, and local files, notes and passwords never go into a URL.

The thirteen sample PDFs in `public/samples/` are original fixtures, defined in `scripts/fixtures/pdf-fixtures.mjs` (three starters) and `scripts/fixtures/example-fixtures.mjs` (ten examples). Regenerate them with `node scripts/fixtures/generate.mjs`; `tests/example-fixtures.test.ts` checks the object relationships the examples rely on. The example font is regenerated with `python3 scripts/fixtures/make-example-font.py` (fonttools 4.63.0).

Each example has a preview image in `public/examples/`, rendered with Poppler (except `broken-xref.png`, a screenshot of the Issues panel). After changing a fixture, refresh its image:

```sh
pdftoppm -scale-to 900 -singlefile -png public/samples/<name>.pdf public/examples/<name>
```

## Search engines

`robots.txt` allows all crawling, and the site has no analytics or third-party scripts. `public/google12102f9747494f61.html` and `public/BingSiteAuth.xml` verify the site with Google Search Console and Bing Webmaster Tools; keep them in `public/`.
