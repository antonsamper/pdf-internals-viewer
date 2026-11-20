# Browser tests

The browser suite is a single Playwright file, `tests/e2e.spec.ts`, configured in `playwright.config.ts`. It runs in Chromium, Firefox and WebKit; choose engines with `--browser=chromium`, `--browser=firefox`, `--browser=webkit` or `--browser=all`. Playwright's WebKit is the engine Safari is built on, not the Safari application, and nothing runs on iOS or iPadOS.

Every engine uses Playwright's Desktop Chrome device settings with a 1440 × 1000 viewport. Many tests resize the page to phone or tablet widths, such as 390 × 844, for their mobile checks. Each test has 45 seconds, and each assertion waits up to 12 seconds.

## What the suite covers

- Opening documents: the empty workspace and starter samples, drag and drop, uploading and replacing files, cancelling a slow open, parse failures, and encrypted PDFs with and without a password.
- Navigation: following references, Back and Forward history across sections and exact byte ranges, and restoring inspector tabs, hex-pane positions and list scroll positions.
- Inspection: raw and decoded streams, `TJ` explanations, compressed-object provenance, hex offsets and keyboard controls, exploration trails, cyclic references, the page tree and the Issues panel.
- Search: key, hex and page-text search, result stepping, preview highlights that follow rotation and zoom, and the results popover at several widths.
- Resources: fonts, image thumbnails, PNG and JPEG export, and attachment and embedded-font downloads.
- Bookmarks, notes and comparison, including blocked browser storage and synchronisation between two tabs.
- The local EmbedPDF preview, which must make no external requests and raise no runtime errors.
- Public pages: reading them with JavaScript disabled, grouped navigation, sample links, the worked examples, and keeping the open PDF while moving between content pages.
- Appearance: the theme button, persistence, blocked storage and syncing between tabs.
- Narrow screens: pane navigation without horizontal overflow, and compact headers.

## Server modes

`playwright.config.ts` picks the server from environment variables:

| Mode | Server | Address |
| --- | --- | --- |
| Default | `pnpm run dev` (Vite development server) | `http://127.0.0.1:5173` |
| `PLAYWRIGHT_PREVIEW=1` | `pnpm run preview` (Vite preview of `dist/`) | `http://127.0.0.1:5173` |
| `PLAYWRIGHT_CLOUDFLARE=1` | `pnpm exec wrangler pages dev dist` (local Pages runtime) | `http://127.0.0.1:8787` |
| `PLAYWRIGHT_BASE_URL=<url>` | None; tests use the given site | `<url>` |

The preview and Cloudflare modes serve `dist/`, so run `pnpm run build` first. `PLAYWRIGHT_BASE_URL` takes precedence over the other variables and is the way to test a separately running server or production.

The test `prerenders home and About for readers without JavaScript` is skipped in the default development mode, because the development server does not serve prerendered HTML for those routes. It runs in the other three modes.

## Running locally

```sh
pnpm run build
pnpm exec playwright install chromium firefox webkit

# All engines against a local Pages server, as CI does
PLAYWRIGHT_CLOUDFLARE=1 pnpm run test:e2e --browser=all

# One engine against the Vite preview of dist/
PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=webkit

# Production
PLAYWRIGHT_BASE_URL=https://pdf-internals-viewer.pages.dev pnpm run test:e2e --browser=all
```

Stop any server already listening on port 5173 before a default or preview run. Outside CI (when `CI` is unset), Playwright reuses whatever answers on that port. A development server left running would then be tested in place of the preview build, without any warning. Cloudflare mode never reuses a server: it always starts its own Wrangler process and stops it afterwards, and it fails to start if port 8787 is already in use.

Tests run with four workers and `fullyParallel`, locally and in CI. Use `--workers=1` for serial debugging or `--workers=N` to change concurrency.

Tests that take screenshots write them to `.context/<browser>/`, one directory per engine, so `--browser=all` runs do not overwrite each other. Playwright keeps a screenshot and trace for each failed test under `test-results/`; open a trace with `pnpm exec playwright show-trace <path-to-trace.zip>`. Both directories are gitignored.

## Continuous integration

The `browsers` job in `.github/workflows/ci.yml` runs after the `check` job. It has one matrix entry per engine, and an engine failure does not cancel the others. Each entry:

1. installs dependencies and that engine with `pnpm exec playwright install --with-deps <engine>`;
2. runs `pnpm run build`;
3. runs the whole suite for that engine with `PLAYWRIGHT_CLOUDFLARE=1`, against the built site in the local Pages runtime;
4. runs **Verify parser in native development workers**, a subset against the Vite development server:

   ```sh
   pnpm run test:e2e --browser=<engine> --grep 'follows page references|uploads and replaces|distinguishes compressed'
   ```

   The development server loads the parser worker as an unbundled module worker. This step checks that the generated parser adapter and its prebundled dependencies work there as well as in the production bundle.

`CI` is set on GitHub runners, so neither step reuses an existing server. Production deploys only after all three engines pass; see [HOSTING.md](HOSTING.md).
