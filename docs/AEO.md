# Public content and discovery

PDF Internals uses React and Vite to generate a static site hosted on Cloudflare Pages. Pages are rendered at build time, so serving them needs no backend.

## Rendering and maintenance

`src/lib/site-content.ts` defines the public routes, site identity, metadata, structured data, privacy summary and allowed samples. `src/content/public-page.tsx` contains the guide, privacy/limitations references and six task guides. `src/content/overview-pages.tsx` contains the audience and inspector/viewer comparison pages. Shared navigation uses explicit groups and short labels in `src/lib/site-navigation.ts` and components in `src/components/content-navigation.tsx`; related reading is curated per route. `src/content/examples.tsx` and `src/content/more-examples.tsx` contain nine worked debugging examples and their index. Bundled tutorial examples correspond to the original fixture definitions in `scripts/fixtures/pdf-fixtures.mjs` and `scripts/fixtures/example-fixtures.mjs`; regenerate PDFs using the existing fixture workflow when examples change. Update reviewed dates only after checking the content against the implementation.

`pnpm run build` builds client assets, then `scripts/prerender.mjs` uses Vite's TSX loader and React's server APIs at build time:

- `/` and `/about` contain the rendered React app. `src/main.tsx` hydrates that HTML. Initial rendering must remain independent of browser APIs; browser reads belong in effects or event handlers. Narrow-screen layout adapts after hydration.
- `/who-its-for`, `/pdf-inspector-vs-viewer`, `/guide`, `/privacy`, `/limitations`, the six `/guides/*` pages and ten example pages at `/examples` and `/examples/*` are static HTML with shared styles and no inspector JavaScript. Their normal links work without JavaScript.
- Every page loads the small `public/theme.js` script before rendering to apply the saved appearance or device setting. The header's sun/moon button saves an explicit light or dark choice; static articles still work with JavaScript disabled.
- Client navigation from the running inspector renders the same article components without unmounting the PDF workspace. The User guide dialogue links to the full guide. Back/Forward and metadata follow the public route.
- `/?sample=minimal`, `/?sample=resources` `/?sample=compressed`, `/?sample=oversized-image` and `/?sample=incorrect-unicode` open only allowlisted bundled samples. Unknown values are ignored. These links start a new workspace; local files, notes and passwords never go into URLs.
- `dist/sitemap.xml` is generated from the route inventory. `public/robots.txt` advertises it. Existing `404.html` prevents a catch-all SPA response from masking missing content.

During development, a Vite middleware serves article components directly; the homepage/About use the normal development client entry. Use the production build to check how home/About behave with JavaScript disabled. Do not directly edit generated HTML in `dist/`.

`pnpm run check:public-pages` runs automatically after each build. It checks readable HTML, local links, canonical/social metadata, JSON-LD, sitemap, robots policy, privacy wording, and article script isolation. `pnpm run deploy:check` additionally validates the static upload and existing licence obligations.

## Reading text instructions

The Streams guide explains how to find visible words in decoded syntax and read `TJ` arrays, including split strings, spacing adjustments and decoded byte offsets. Its “at varius lorem” excerpt is illustrative and is not part of the bundled Fonts & resources sample. The inspector shows a collapsible explanation when a content stream contains `TJ`, with an in-app guide link that preserves the loaded PDF. The inspector and guide link to the PDF Association operator reference in a new tab.

## Production verification after publication

Fetch all sitemap URLs and inspect initial response HTML. Verify extensionless routes and refreshes, missing-page 404 responses, canonical URLs and final robots.txt after hosting injection. Verify `/about.html` continues to normalise to `/about`. Inspect Cloudflare crawler/security settings separately from robots directives. A synthetic bot user-agent is not proof of verified bot network access.

The robots policy allows public crawling. Search retrieval and model training controls are separate publisher choices; do not change one merely to influence the other. No analytics or new third-party script has been added.

## Discovery baseline and follow-up

The 14 November 2026 audit found two public HTML shells, no sitemap and no static guides. Raw responses and the full audit are in the workspace's ignored `.context/` directory. Real indexing, crawl frequency, search traffic, AI citations, and current public/mobile Core Web Vitals were not measured. Passing build checks does not show an increase in traffic or citations.

Account-level work remains manual until the necessary access is available:

1. Verify the production property in Google Search Console and Bing Webmaster Tools; submit `/sitemap.xml`.
2. Inspect home, About and a representative tutorial for indexability and rendered content. Record indexed URLs, impressions, clicks and relevant queries before comparing later periods.
3. Periodically sample a fixed set of questions, recording engine/mode, date, exact prompt, cited URL and factual accuracy. Suggested questions: “What does 3 0 R mean in a PDF?”, “How can I inspect PDF objects without uploading my file?”, “How do I decode a PDF content stream?”, and “How can I find embedded fonts and images in a PDF?” Treat repeated answer-engine observations as noisy qualitative evidence.
4. Review verified crawler logs and hosting rules. Do not infer a block from an unsuccessful search-tool fetch alone.
5. Measure the current deployed landing pages on representative network/device conditions. The older `docs/PERFORMANCE.md` baseline describes a different build and document-opening workload.
6. If aggregate activation analytics are later added, count guide visits, guide-to-inspector transitions, sample opens and successful PDF opens. Exclude filenames, PDF contents, document hashes, passwords, selections and notes. Referrer attribution can be incomplete.

Publish original worked examples and seek relevant editorial references after the new pages are live. Avoid fabricated mentions, generic article batches, hidden instructions, or promises of guaranteed AI inclusion.

## References

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [React hydration](https://react.dev/reference/react-dom/client/hydrateRoot)
- [React static markup](https://react.dev/reference/react-dom/server/renderToStaticMarkup)
- [OpenAI search and training crawlers](https://developers.openai.com/api/docs/bots)

## Worked debugging examples

`/examples` links to nine walkthroughs: file size, incorrect text, font embedding, attachments, repeated logos, rotation, inherited resources, opening actions, and a broken cross-reference. Each has exact object IDs, a downloadable PDF, and an allowlisted link into the inspector. These nine samples are separate from the three starter buttons. Run `node scripts/fixtures/generate.mjs` to regenerate all twelve PDFs using Node. The large sample stores 4,320,000 bytes of raw RGB data; the text sample maps source code `<31>` to Unicode `<0039>` while rendering the digit 1.

The action walkthrough keeps `/examples/opening-action`: the descriptive URL matches its downloadable opening-action sample and existing links. Its title, description and introduction also explain the broader PDF actions topic, with common action types and triggers before the worked `/GoTo` inspection. Keep the distinction between a trigger (`/OpenAction`, `/A`, `/AA`) and an action type (`/S`); an opening destination is not necessarily an action dictionary or a script. Type definitions link to Adobe’s reference documentation.

This URL choice follows [Google’s descriptive URL guidance](https://developers.google.com/search/docs/crawling-indexing/url-structure). Google’s [AI search guidance](https://developers.google.com/search/docs/appearance/ai-features) applies the same SEO fundamentals without special AI markup. Neither the path nor the expanded content guarantees indexing or citations.

The font example uses the original geometric H glyph in `scripts/fixtures/assets/example-mark.ttf`. Its optional regeneration script, `python3 scripts/fixtures/make-example-font.py`, needs fonttools 4.63.0. The file has fixed timestamps so regeneration is deterministic; ordinary PDF regeneration reads the checked-in font without Python. No third-party font is bundled. The opening-action example uses a local `/GoTo` destination, with no JavaScript, launch action, or remote target.

The checked-in previews under `public/examples/` are renders of the corresponding PDFs, except `broken-xref.png`, which shows the Issues panel and its findings. After changing a fixture, refresh its page preview with Poppler: `pdftoppm -scale-to 900 -singlefile -png public/samples/oversized-image.pdf public/examples/oversized-image` (repeat with the sample's filename). The rotation preview is landscape, 900 × 696; the other PDF renders are 696 × 900. Render every page of the logo and rotation PDFs when reviewing them. Verify `pdftotext public/samples/incorrect-unicode.pdf -` returns `Invoice total: £9,250.00`, and visually confirm its preview shows £1,250.00.

The sample tests check reproducibility and the object relationships used by the walkthroughs. Browser tests follow resource references, verify complete font and attachment downloads, and check the static pages with JavaScript disabled and at mobile widths.

## Public navigation

Public pages share an Overview / Guides / Examples header with an inspector action. About and articles show a grouped sidebar on wide screens, or a native “On this site” disclosure above the content on narrower screens. Links work without JavaScript. The current page is marked with `aria-current`; breadcrumbs use short page titles. Each article ends with three relevant next steps labelled by content type, rather than the full route inventory. In-app navigation preserves the open PDF and selection. Workspace controls remain available on the inspector route; an open session can also be closed from public pages.
