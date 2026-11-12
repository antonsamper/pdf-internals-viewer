# Browser verification

Recorded on 2026-11-11 with Playwright 1.65.0, using production assets served by Vite preview on macOS/arm64.

| Engine | Result | Notes |
| --- | --- | --- |
| Chromium | 9/9 passed | Final production build, including patched worker and fallback-source artifacts |
| Firefox 159.0 | 9/9 passed | Production build after the focus-return fix and primary worker backport |
| WebKit 27.2 | 9/9 passed | Production build after the focus-return fix and primary worker backport; not the actual Safari application |

The nine tests cover initial state, reference/history navigation, raw/decoded streams, compressed object provenance, hex offset/keyboard controls, upload/replacement, search, local EmbedPDF rendering/zoom without external document requests, narrow-screen panes, and limitations-dialog access/scrolling/dismissal/focus.

WebKit revealed that closing a controlled dialog did not return focus to the clicked opener: unlike Chromium and Firefox, clicking a native button did not reliably focus it first. The app now records the explicit opener and passes it to Base UI's `finalFocus`. The existing focus regression test then passed across all three engines.

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

These are automated core-flow checks, not a claim of complete PDF compatibility, real Safari/iOS testing, or measured browser memory budgets. The independent PDF corpus runs the inspection engine in Node; broader combinations of those files with each browser remain useful follow-up coverage.


## Clean pnpm production verification — 2026-11-12

After the pnpm migration, `PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=all` passed **27/27** tests in 31 seconds against the freshly built root `dist/`: 9 each in Chromium, Firefox and WebKit. This run used pnpm 10.33.4's clean frozen-lockfile dependency tree and the complete patched preview artifact set. Actual Safari application testing remains separate.
