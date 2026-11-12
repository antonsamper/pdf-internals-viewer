# Cloudflare Pages hosting

Updated 2026-11-12. Public app: **https://pdf-internals-viewer.pages.dev**.

## Project and account separation

The app has its own Cloudflare Pages project, `pdf-internals-viewer`, with a project-specific `pages.dev` hostname. It uses the existing Cloudflare account but no account-wide Workers hostname. The former Worker has both its production subdomain and preview URLs disabled; HTTP checks confirm the old address and version-preview sample return 404 and no longer serve the app. Other projects and the shared account namespace were not modified.

## Build and publish

Node.js 22.18+, pinned pnpm 10.33.4, and pinned Wrangler 4.160.1 are required. Install hooks must run: they generate the parser and apply the exact-hash preview validation backport.

```sh
pnpm install --frozen-lockfile
pnpm run deploy:check
pnpm run deploy
```

`wrangler.jsonc` declares `pages_build_output_dir: "./dist"`. `deploy:check` builds, checks the preview modification notices and exact native WASM/notice inventory, then validates the static Pages upload. The upload checker requires `index.html` and `404.html`, rejects symlinks/hidden files/server-side entry points, and checks Pages' 20,000-file/25-MiB-per-file limits. It does not publish or need credentials.

`deploy` publishes `dist/` to the existing Pages project with `--branch main`, its production branch. The app currently uses **Direct Upload**, not Git integration. Publishing is manual; a local checkout can publish without merging a branch. A Direct Upload project cannot later be switched to Git integration in place; future automatic publishing can instead use a CI upload or a newly created Git-integrated Pages project.

Check/login using `pnpm exec wrangler whoami` / `pnpm exec wrangler login`. If more than one account is available, set `CLOUDFLARE_ACCOUNT_ID` to the intended account. Never commit tokens or local credentials. To inspect deployments:

```sh
pnpm exec wrangler pages deployment list --project-name pdf-internals-viewer
```

Wrangler in this environment automatically delegates creation of new Pages projects back to Workers. Initial setup explicitly used `wrangler pages project create pdf-internals-viewer --production-branch main --force` to create Pages directly. Here `--force` opts out of that delegation; it did not overwrite an existing project. Normal subsequent uploads use the existing project and do not need this flag.

## Serving behavior

Only `dist/` is uploaded. No document upload endpoint, database, server-side functions or Worker script is used. User PDFs remain local to the visitor's browser.

`public/404.html` deliberately disables Pages' default SPA fallback: nonexistent workers/WASM/private-source paths return 404 instead of receiving HTML. The app has one entry URL and does not need client-route fallback rewrites. `public/_headers` sets HTML revalidation, immutable caching for hashed assets, `nosniff` and referrer policy. JavaScript workers, WASM, fonts, samples and notices are all served from this app's own origin. A custom domain is optional.

## Verification

- Build, native/preview notice checks, Pages upload validation, lint and type checking passed.
- `PLAYWRIGHT_CLOUDFLARE=1 pnpm run test:e2e --browser=all` starts/stops `wrangler pages dev dist` and passed **27/27** in 29.9 seconds. CI uses the same Pages mode and performs upload validation without credentials.
- `PLAYWRIGHT_BASE_URL=https://pdf-internals-viewer.pages.dev pnpm run test:e2e --browser=all` passed **27/27** in 36.7 seconds: 9 each in Chromium, Firefox and WebKit. Tests include file upload/replacement and preview rendering with no external requests, document uploads or runtime errors in that tested flow.
- Hosted HTML matches the built HTML. All 64 native notice/evidence files, native bundle, combined notice inclusion and exact WASM hash passed HTTPS verification. JS/parser/preview workers, fonts and WASM have the expected MIME types and immutable caching. HTML revalidates. Missing assets/private-source paths return 404.
- Current deployment: `5660f026` (production branch `main`). Its deployment-specific URL is `https://5660f026.pdf-internals-viewer.pages.dev`; the stable production URL is above.
- The former Worker's subdomain API confirms `enabled=false` and `previews_enabled=false`; it is retained only as a disabled resource. No unrelated Worker/Pages project or account-wide hostname was changed.

Evidence stays in ignored `.context/pages-local-browsers.log`, `pages-live-browsers.log`, `pages-live-checks.json`, `legacy-worker-disabled.json` and `pages-legacy-host-check.json`. Actual Safari application testing remains separate; WebKit automation is not that test. The native source inventory's scope and maintenance checks are in [NOTICES.md](NOTICES.md).

## Sources

- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages serving and 404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Worker subdomain controls](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/)
