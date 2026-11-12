# Browser verification

Recorded on 2026-11-11 with Playwright 1.65.0, using production assets served by Vite preview on macOS/arm64.

| Engine | Result | Notes |
| --- | --- | --- |
| Chromium | 9/9 passed | Final production build, including patched worker and fallback-source artifacts |
| Firefox 159.0 | 9/9 passed | Production build after the focus-return fix and primary worker backport |
| WebKit 27.2 | 9/9 passed | Production build after the focus-return fix and primary worker backport; not the actual Safari application |

The nine tests cover the initial state; reference navigation and history; raw and decoded streams; compressed-object provenance; hex offsets and keyboard controls; file upload and replacement; search; local EmbedPDF rendering and zoom without external document requests; narrow-screen panes; and limitations-dialog access, scrolling, dismissal, and focus.

In WebKit, closing a controlled dialog did not return focus to the clicked opener: unlike Chromium and Firefox, clicking a native button did not reliably focus it first. The app now records the explicit opener and passes it to Base UI's `finalFocus`. The existing focus regression test then passed across all three engines.

Early development-server failures caused by simultaneous dependency changes and generated-module rewrites are excluded from these results. Production assets isolate browser tests from HMR. After the Firefox/WebKit runs, an additional embedded worker-source fallback was patched and verified with the bundled-validator behavior tests; the final Chromium run used that complete build. The standard worker rendering path passed in all three engines.

CI is configured to run all three engines against production builds. For local reproduction:

```sh
pnpm run build
pnpm exec playwright install chromium firefox webkit
PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=chromium
PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=firefox
PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=webkit
```

Stop any existing server on port 5173 before using this recipe, or set `PLAYWRIGHT_BASE_URL` to a separately running production server. Detailed local logs are under ignored `.context/`.

These automated checks cover core flows. They do not establish complete PDF compatibility, Safari/iOS behavior, or browser memory budgets. The independent PDF corpus runs the inspection engine in Node; broader combinations of those files with each browser remain useful follow-up coverage.

## Clean pnpm production verification: 2026-11-12

After the pnpm migration, `PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=all` passed 27/27 tests in 31 seconds against the freshly built root `dist/`: 9 each in Chromium, Firefox and WebKit. This run used pnpm 10.33.4's clean frozen-lockfile dependency tree and the complete patched preview artifact set. Actual Safari application testing remains separate.

## Cloudflare runtime verification

`PLAYWRIGHT_CLOUDFLARE=1 pnpm run test:e2e --browser=all` starts and stops Wrangler locally against the built `dist/`, without relying on a previously running server. CI's browser matrix now uses this mode. Explicit `PLAYWRIGHT_BASE_URL` still targets a deployed site. An earlier attempt failed before reaching the app because the external local server had stopped. Those connection-refused results establish neither an application failure nor passing coverage.

## Live Cloudflare verification: 2026-11-12

The initial, now-retired Workers deployment passed 27/27 in 36.7 seconds against the public deployment: 9 each in Chromium, Firefox and WebKit. This includes preview rendering without external requests, document writes/uploads or runtime errors in the tested flow. The managed local Cloudflare run also passed 27/27 in 32.6 seconds. The earlier stopped-server failure required no application changes. Actual Safari application testing remains separate.


## Cloudflare Pages migration — 2026-11-12

The managed Cloudflare mode now runs `wrangler pages dev dist`. All 27 local checks passed in 29.9 seconds. The same 27 checks passed against https://pdf-internals-viewer.pages.dev in 36.7 seconds, across Chromium, Firefox and WebKit. Pages' explicit `404.html` prevents missing worker/WASM files receiving an HTML shell. Hosted HTML, worker/WASM/font MIME and caching, all 64 native notice/evidence hashes, combined notice inclusion and exact WASM passed HTTP checks. The previous Worker production and preview addresses were disabled after the Pages deployment passed. Actual Safari testing remains open.

## Navigation context follow-up — 2026-11-12

The production-preview suite now contains 12 scenarios per engine, including section and exact-byte-range history, unknown-byte messages, forward-branch replacement, and returning from a deeply scrolled object list to a smaller section. `CI=1 PLAYWRIGHT_PREVIEW=1 pnpm exec playwright test --browser=all` passed 36/36 checks across Chromium, Firefox and WebKit. This is local production-build evidence; the published deployment was not changed. Inspector and byte-pane scroll-position restoration remains deferred.
