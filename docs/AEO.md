# Public content and discovery

PDF Internals uses React and Vite to generate a static site hosted on Cloudflare Pages. It needs no backend or HTML rendering when a visitor requests a page.

## Rendering and maintenance

`src/lib/site-content.ts` defines the public routes, site identity, metadata, structured data, privacy summary and allowed samples. `src/content/public-page.tsx` contains the guide, privacy/limitations references and three worked tutorials. Tutorial examples correspond to the original fixture definitions in `scripts/fixtures/pdf-fixtures.mjs`; regenerate PDFs using the existing fixture workflow when examples change. Update reviewed dates only after checking the content against the implementation.

`pnpm run build` builds client assets, then `scripts/prerender.mjs` uses Vite's TSX loader and React's server APIs at build time:

- `/` and `/about` contain the rendered React app. `src/main.tsx` hydrates that HTML. Initial rendering must remain independent of browser APIs; browser reads belong in effects or event handlers. Narrow-screen layout adapts after hydration.
- `/guide`, `/privacy`, `/limitations` and the three `/guides/*` pages are static HTML with shared styles and no inspector JavaScript. Their normal links work without JavaScript.
- Client navigation from the running inspector renders the same article components without unmounting the PDF workspace. The User guide dialogue links to the full guide. Back/Forward and metadata follow the public route.
- `/?sample=minimal`, `/?sample=resources` and `/?sample=compressed` open only allowlisted bundled samples. Unknown values are ignored. These links start a new workspace; local files, notes and passwords never go into URLs.
- `dist/sitemap.xml` is generated from the route inventory. `public/robots.txt` advertises it. Existing `404.html` prevents a catch-all SPA response from masking missing content.

During development, a Vite middleware serves article components directly; the homepage/About use the normal development client entry. Use the production build to check how home/About behave with JavaScript disabled. Do not directly edit generated HTML in `dist/`.

`pnpm run check:public-pages` runs automatically after each build. It checks readable HTML, local links, canonical/social metadata, JSON-LD, sitemap, robots policy, privacy wording, and article script isolation. `pnpm run deploy:check` additionally validates the static upload and existing licence obligations.

## Production verification after publication

Fetch all sitemap URLs and inspect initial response HTML. Verify extensionless routes and refreshes, missing-page 404 responses, canonical URLs and final robots.txt after hosting injection. Verify `/about.html` continues to normalise to `/about`. Inspect Cloudflare crawler/security settings separately from robots directives. A synthetic bot user-agent is not proof of verified bot network access.

The robots policy allows public crawling. Search retrieval and model training controls are separate publisher choices; do not change one merely to influence the other. No analytics or new third-party script has been added.

## Discovery baseline and follow-up

The 14 November 2026 audit found two public HTML shells, no sitemap and no static guides. Raw responses and the full audit are in the workspace's ignored `.context/` directory. Real indexing, crawl frequency, search traffic, AI citations, and current public/mobile Core Web Vitals were not measured. Passing build checks does not show an increase in traffic or citations.

Account-level work remains manual until the necessary access is available:

1. Verify the production property in Google Search Console and Bing Webmaster Tools; submit `/sitemap.xml`.
2. Inspect home, About and a representative tutorial for indexability and rendered content. Record indexed URLs, impressions, clicks and relevant queries before comparing later periods.
3. Periodically sample a fixed set of questions, recording engine/mode, date, exact prompt, cited URL and factual accuracy. Suggested questions: “What does 3 0 R mean in a PDF?”, “How can I inspect PDF objects without uploading my file?”, “How do I decode a PDF content stream?”, and “How can I find embedded fonts and images in a PDF?” Treat repeated answer-engine observations as noisy qualitative evidence.
4. Review actual verified crawler logs and hosting rules. Do not infer a block from an unsuccessful search-tool fetch alone.
5. Measure the current deployed landing pages on representative network/device conditions. The older `docs/PERFORMANCE.md` baseline describes a different build and document-opening workload.
6. If aggregate activation analytics are later added, count guide visits, guide-to-inspector transitions, sample opens and successful PDF opens. Exclude filenames, PDF contents, document hashes, passwords, selections and notes. Referrer attribution can be incomplete.

Publish original worked examples and seek relevant editorial references after the new pages are live. Avoid fabricated mentions, generic article batches, hidden instructions, or promises of guaranteed AI inclusion.

## References

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [React hydration](https://react.dev/reference/react-dom/client/hydrateRoot)
- [React static markup](https://react.dev/reference/react-dom/server/renderToStaticMarkup)
- [OpenAI search and training crawlers](https://developers.openai.com/api/docs/bots)
