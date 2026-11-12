# Project operations

## Deploy Configuration

- Platform: Cloudflare Pages, static-only Vite/React app; no backend/functions.
- Config: `wrangler.jsonc`; `pages_build_output_dir` is `./dist`; project `pdf-internals-viewer`.
- Production URL: https://pdf-internals-viewer.pages.dev
- Production branch: `main`; Direct Upload via CLI, not automatic Git integration.
- Deploy trigger: `pnpm run deploy`; native notice predeploy check, build/postbuild verification and static upload validation run before `wrangler pages deploy dist --project-name pdf-internals-viewer --branch main`.
- Dry verification: `pnpm run deploy:check` builds and validates assets without publication or credentials. Do not use `wrangler deploy` (Workers) for this Pages project.
- Deploy status: `pnpm exec wrangler pages deployment list --project-name pdf-internals-viewer`.
- Local platform preview: `pnpm run preview:cloudflare` serves built `dist/` using Pages on port 8787.
- Browser checks: `PLAYWRIGHT_CLOUDFLARE=1 pnpm run test:e2e --browser=all` owns local Pages server lifecycle; `PLAYWRIGHT_BASE_URL=https://pdf-internals-viewer.pages.dev pnpm run test:e2e --browser=all` checks production.
- Health: GET `/`; verify workers/WASM/fonts MIME/caching, missing/private-path 404s, exact native WASM and notice hashes.
- Keep `public/404.html`: it prevents missing assets receiving Pages' SPA HTML fallback.
- Native notices: independently reviewed exact-source/toolchain superset; predeploy/postbuild checks pin the WASM and source text hashes. See `docs/NOTICES.md`.
- Account: existing Cloudflare account; public hostname is project-specific. Do not re-enable the retired Worker's production or preview subdomains or change the account-wide Workers namespace.
- Credentials remain outside Git. Verify the account/project before publication.

Verified deployment `5660f026` on 2026-11-12: 27/27 local Pages tests, 27/27 live tests, hosted asset/WASM/native-notice hashes and 404 checks passed. Former Worker subdomains are disabled. See `docs/HOSTING.md`.
