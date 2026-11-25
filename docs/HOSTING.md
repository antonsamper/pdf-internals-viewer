# Cloudflare Pages hosting

PDF Internals Viewer is a static site hosted on Cloudflare Pages at https://pdf-internals-viewer.pages.dev, in the Pages project `pdf-internals-viewer`. Everything runs in the visitor's browser: there is no backend, database or server-side code, and PDFs are never uploaded.

## Deployment

Production deploys only from the `deploy` job in `.github/workflows/ci.yml`, after a merge to `main` and once the `secrets`, `check` and `browsers` jobs pass. Pull requests never deploy, and neither does a merge that only changes documentation, because `check` and `browsers` skip it (see [BROWSERS.md](BROWSERS.md#continuous-integration)). Never deploy manually, and never use `wrangler deploy`, which targets Workers rather than Pages.

The job builds the site in GitHub Actions and uploads `dist/` with Cloudflare's Direct Upload, so the files that ship come from the same pinned, hash-checked build that CI tested. Cloudflare's alternative, Git integration, would rebuild every push in Cloudflare's own environment, needs Cloudflare's GitHub app on the repository and by default publishes a public preview of every branch. The project has no preview deployments. A Direct Upload project cannot be switched to Git integration in place.

The job needs two repository Actions secrets: `CLOUDFLARE_API_TOKEN`, an API token with the Account / Cloudflare Pages / Edit permission scoped to the hosting account, and `CLOUDFLARE_ACCOUNT_ID`. Pull request runs never receive them.

Rerunning an old `main` workflow run publishes that old commit again, so retry from the latest run.

## Analytics

Cloudflare Web Analytics is turned on in the Pages project's settings in the Cloudflare dashboard. Cloudflare adds its beacon script to each HTML page as it serves it, so the script is not in the repository or in `dist/`, and local builds and the browser tests run without it. The privacy page describes what the beacon collects; update it if this setting changes.

## Checking locally

After `pnpm run build`:

```sh
# Serve dist/ with the local Pages runtime on http://127.0.0.1:8787
pnpm run preview:cloudflare

# Run the browser suite against a fresh local Pages server, as CI does
PLAYWRIGHT_CLOUDFLARE=1 pnpm run test:e2e --browser=all
```
