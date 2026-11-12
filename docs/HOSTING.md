# Hosting options

Prepared 2026-11-12. The user requested options; no provider has been selected and nothing has been deployed.

## Recommendation

For a first public preview, Netlify is the simplest fit in my assessment: its documented Vite integration uses the existing build command and `dist` output, without adding an application backend or changing the SPA framework. Cloudflare Workers Static Assets is also a good option for an assets-only deployment. GitHub Pages fits a repository-centered public project but needs explicit base-path/deployment workflow work.

| Provider | How this app fits | Additional setup |
| --- | --- | --- |
| Netlify | Existing Vite static build; documented automatic detection of build command and publish directory | Connect repository, select Node/build settings, preview branch/domain, then verify WASM/workers/headers |
| Cloudflare Workers Static Assets | Serve the built `dist` directory as static assets; no PDF processing on the server | Assets-only Wrangler configuration, deployment project/account and domain; no need to adopt a backend template |
| GitHub Pages | Build the SPA in GitHub Actions and publish its artifact | Pages workflow/permissions and the Vite base path, especially for a repository subdirectory |

Provider plans, quotas, account eligibility, custom-domain setup and current pricing should be confirmed when choosing the deployment. This comparison makes no zero-cost guarantee.

## Common build contract

- Node 22.18 or later, consistent with package metadata.
- Use Node.js 22.18+ and pnpm 10.33.4, with `pnpm install --frozen-lockfile` followed by `pnpm run build`. `packageManager` and `pnpm-lock.yaml` define the build contract. Preparation hooks must remain enabled.
- Install lifecycle scripts must run: they prepare the parser and apply the version/hash-checked preview validation patch. An install with scripts disabled followed by a raw Vite build is not the tested release pipeline.
- Publish only `dist/`. Do not publish `.context`, corpus downloads, `node_modules`, source research artifacts, or the Vite development/preview server.
- User PDFs remain local. The host serves application assets, WASM, fonts, notices, and original samples; it needs no document upload endpoint, database, or PDF service.

## Asset and route checks

The PDFium WASM is about 7.9 MB uncompressed. The normal JavaScript worker, inline worker, embedded source fallback, parser worker and fonts are emitted by Vite and must resolve from the same deployment. Confirm the chosen provider's current individual-asset limit before publishing.

Serve `.wasm` as `application/wasm` and JavaScript worker files with an appropriate JavaScript MIME type. Missing asset URLs must not silently receive the SPA HTML shell. Check hashed-asset caching separately from HTML freshness. Any CSP added later must be tested with the worker/WASM/Blob URL paths actually used by EmbedPDF rather than copied from a generic website template.

The app currently uses one entry URL, so it does not require arbitrary client-route rewrites. A provider's optional SPA fallback should be configured deliberately, preserving asset errors.

For GitHub project Pages at `https://<owner>.github.io/<repo>/`, use `base: '/<repo>/'` in the build; a root/custom-domain deployment uses `/`. For example, the existing build script can receive `--base=/pdf-internals-viewer/`. Verify sample fetches, font URLs, worker/WASM URLs, and credits links under that prefix.

## Preview acceptance before public launch

1. Close the dependency-resolution review findings and repeat the canonical clean-install checks.
2. Complete third-party notices, especially the exact PDFium/WASM native dependency bundle. The owner has selected MIT for original project code; that does not replace dependency notices.
3. Deploy a reviewable preview on the chosen account/provider. Choose the project/domain explicitly before publishing it as the public site.
4. Test a locally selected PDF and original samples: objects, references, raw/decoded streams, original bytes, preview rendering, file replacement and keyboard focus.
5. Check the network: no document content uploaded, no unexpected external document requests, no failed worker/WASM/font loads, and notice/license files accessible.
6. Run the production browser suite against the preview URL and smoke-test the Safari application itself.
7. Publish the agreed domain only after the preview's remaining issues are resolved.

## Primary sources

Checked 2026-11-12:

- [Netlify: Vite setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) documents `npm run build` and `dist` detection.
- [Cloudflare: Static Assets](https://developers.cloudflare.com/workers/static-assets/) documents directory-based static publishing and asset-first routing.
- [Cloudflare Pages framework guide](https://developers.cloudflare.com/pages/framework-guides/) currently recommends Workers for new Cloudflare projects; do not assume an older Pages tutorial is the current preferred path.
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) is the reference to check for the selected asset/deployment limits.
- [Vite static deployment guide](https://vite.dev/guide/static-deploy.html) documents project/root base paths and GitHub Pages deployment. It also states that `vite preview` is a local preview server, not a production server.
