# Project operations

## Deploy Configuration

- Platform: Cloudflare Workers Static Assets, assets-only Vite/React app.
- Configuration: `wrangler.jsonc`; Worker name `pdf-internals-viewer`; uploaded directory `dist/` only.
- Production URL: https://pdf-internals-viewer.pricepaiddata.workers.dev
- Project type: static web app. PDF inspection and preview run locally in the browser.
- Deploy workflow: manual CLI; CI validates the build and Wrangler dry run only.
- Deploy status command: `pnpm exec wrangler deployments list` after initial deployment.
- Merge method: follow repository settings; no automatic merge/deploy configured.
- Pre-deploy checks: `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run deploy:check`.
- Deploy trigger: `pnpm run deploy` builds and publishes to the authenticated Cloudflare account.
- Local platform preview: `pnpm run preview:cloudflare` serves built assets on `http://127.0.0.1:8787`.
- Health check: HTTP GET `/`, verify JS/worker/WASM MIME types and missing-asset 404s, then `PLAYWRIGHT_BASE_URL=<deployed URL> pnpm run test:e2e --browser=all`.
- Release status: native notices are a reviewed conservative exact-source/toolchain inventory; `predeploy` and production `postbuild` verify its hashes and exact WASM match. See `docs/NOTICES.md`. A dry run is not a publication.
- Keep credentials out of tracked files. Use Wrangler login or deployment environment credentials. Verify account and existing Worker ownership before publishing.

Latest verified Cloudflare version: `bc262a96-3a5e-488c-a0df-f02188f6ea67` (2026-11-12). Live `/`, asset MIME/caching, exact WASM, all 64 native notice hashes and all 27 browser tests passed.
