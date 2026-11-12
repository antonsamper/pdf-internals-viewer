# Hosting options

Updated 2026-11-12. The app runs on Cloudflare Workers Static Assets in the user's existing account at https://pdf-internals-viewer.pricepaiddata.workers.dev. Local and live verification passed.

## Cloudflare deployment

`wrangler.jsonc` deploys only `dist/`, under Worker name `pdf-internals-viewer`, on Cloudflare's assigned `workers.dev` subdomain (`https://pdf-internals-viewer.pricepaiddata.workers.dev`). There is no Worker application entry point or server-side PDF processing. Unknown URLs return 404 because this app currently has a single entry URL; missing worker/WASM files must never receive the HTML shell.

Pinned Wrangler 4.160.1 is a development dependency. Its exact esbuild/workerd installation hooks are allowlisted in the pnpm configuration; unknown dependency hooks still fail for review. Secrets and local Cloudflare state are ignored by Git. No credentials are embedded in source or browser assets.

```sh
pnpm install --frozen-lockfile
pnpm run deploy:check         # Builds, preserves notices, validates Wrangler; does not upload
pnpm run preview:cloudflare   # Serves the existing dist/ on http://127.0.0.1:8787
# Or have Playwright own the local Cloudflare server lifecycle:
PLAYWRIGHT_CLOUDFLARE=1 pnpm run test:e2e --browser=all
```

The native notice inventory is prepared and has passed independent review; see [NOTICES.md](NOTICES.md). Publishing uses:

```sh
pnpm exec wrangler whoami     # Check account; use wrangler login if not authenticated
pnpm run deploy              # Builds and publishes; record the URL from Wrangler output
```

If multiple accounts are available, set `CLOUDFLARE_ACCOUNT_ID` locally or in the deployment environment to the intended account before publishing. The local session currently resolves one account. The chosen Worker name must be unused, or must already belong to this app, before deploying; do not overwrite an unrelated Worker. A custom domain can be attached in Cloudflare after the first hosted verification.

`public/_headers` gives HTML revalidation, immutable caching for hashed assets, and `nosniff`. Wrangler parses these rules from the built output. CSP remains unset until a policy has been tested against all WASM/worker/Blob fallback paths.

CI validates `wrangler deploy --dry-run` after its production build; it does not deploy or need Cloudflare credentials. Automatic production deployment on merge is not enabled. A future Git integration must use Node 22.18+, pinned pnpm, frozen installs, preparation hooks enabled, build command `pnpm run build`, and deploy command `pnpm exec wrangler deploy`.

## Verification: 2026-11-12

- Production build and Wrangler deployment dry run passed, reading 123 files including the full native notice inventory. The emitted worker modification notices passed their postbuild assertion.
- 82 unit tests, lint and type checking passed with the Wrangler dependency installed.
- All 27 browser tests passed against Wrangler's local Cloudflare runtime on port 8787: 9 each in Chromium, Firefox and WebKit, including local preview rendering without external requests.
- HTTP checks verified HTML, JS/parser/preview workers, WASM and fonts; appropriate MIME types; HTML revalidation; immutable hashed assets; public notice access; and 404s for missing assets, `.context` and `node_modules` paths. Evidence is in ignored `.context/cloudflare-assets-check.json`.
- Existing Cloudflare OAuth authentication was detected successfully. The live deployment is verified below; the actual Safari application remains separately untested.

## Hosting alternatives considered

| Provider | How this app fits | Additional setup |
| --- | --- | --- |
| Netlify | Existing Vite static build; documented automatic detection of build command and publish directory | Connect repository, select Node/build settings, preview branch/domain, then verify WASM/workers/headers |
| Cloudflare Workers Static Assets | Serve the built `dist` directory as static assets; no PDF processing on the server | Assets-only Wrangler configuration, deployment project/account and domain; no need to adopt a backend template |
| GitHub Pages | Build the SPA in GitHub Actions and publish its artifact | Pages workflow/permissions and the Vite base path, especially for a repository subdirectory |

Provider plans, quotas, account eligibility, custom-domain setup and current pricing should be confirmed when choosing the deployment. Costs depend on the selected plan and usage.

## Common build contract

- Use Node.js 22.18+ and pnpm 10.33.4, with `pnpm install --frozen-lockfile` followed by `pnpm run build`. `packageManager` and `pnpm-lock.yaml` define the build contract. Preparation hooks must remain enabled.
- Install lifecycle scripts must run: they prepare the parser and apply the version/hash-checked preview validation patch. An install with scripts disabled followed by a raw Vite build is not the tested release pipeline.
- Publish only `dist/`. Do not publish `.context`, corpus downloads, `node_modules`, source research artifacts, or the Vite development/preview server.
- User PDFs remain local. The host serves application assets, WASM, fonts, notices, and original samples; it needs no document upload endpoint, database, or PDF service.

## Asset and route checks

The PDFium WASM is about 7.9 MB uncompressed. The normal JavaScript worker, inline worker, embedded source fallback, parser worker and fonts are emitted by Vite and must resolve from the same deployment. Confirm the chosen provider's current individual-asset limit before publishing.

Serve `.wasm` as `application/wasm` and JavaScript worker files with an appropriate JavaScript MIME type. Missing asset URLs must not silently receive the SPA HTML shell. Check hashed-asset caching separately from HTML freshness. Test any future CSP with the worker/WASM/Blob URL paths EmbedPDF actually uses. A generic website policy may block them.

The app currently uses one entry URL, so it does not require arbitrary client-route rewrites. A provider's optional SPA fallback should be configured deliberately, preserving asset errors.

For GitHub project Pages at `https://<owner>.github.io/<repo>/`, use `base: '/<repo>/'` in the build; a root/custom-domain deployment uses `/`. For example, the existing build script can receive `--base=/pdf-internals-viewer/`. Verify sample fetches, font URLs, worker/WASM URLs, and credits links under that prefix.

## Preview acceptance before public launch

1. Dependency-resolution findings are closed; repeat the canonical clean-install checks for further dependency changes.
2. Complete third-party notices, especially the exact PDFium/WASM native dependency bundle. The owner has selected MIT for original project code; that does not replace dependency notices.
3. Deploy a reviewable preview on the chosen account/provider. Use the agreed Cloudflare Worker project; record its assigned URL before configuring a custom domain.
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

## Live deployment: 2026-11-12

- URL: https://pdf-internals-viewer.pricepaiddata.workers.dev
- Cloudflare version: `bc262a96-3a5e-488c-a0df-f02188f6ea67`.
- Command: `pnpm run deploy`; predeploy checked native inventory/WASM, build and postbuild checked emitted notices and built WASM, then Wrangler uploaded the static assets and deployed the Worker.
- Production HTML matches the local built HTML. All 64 native public notice/evidence files match their hashes over HTTPS, the native bundle matches its hash, the combined notice includes the entire bundle, and the hosted WASM matches the exact reviewed binary.
- All 27 browser tests passed against the live URL in 36.7 seconds (9 each in Chromium, Firefox and WebKit), including local PDF upload/replacement and preview rendering with no external requests, uploads or runtime errors in that tested flow.
- HTTP checks passed for JS, parser/preview workers, fonts and WASM MIME types/caching; missing assets and private-source paths returned 404. Evidence: ignored `.context/cloudflare-production-checks.json` and `.context/cloudflare-production-browser.log`.
- A custom domain is optional and has not been configured. Publishing remains manual; future deploys use `pnpm run deploy`.
