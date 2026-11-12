# Public release work list

Updated 2026-11-12. This is the shared source of truth for the next release batch. Owner labels describe independent work lanes; a single coordinating agent integrates the results.

## Working rules

- Up to three specialist agents run alongside the coordinator.
- Each agent owns named files. Only the coordinator changes application code, dependencies, lockfiles, shared production builds, or CI during this batch.
- Build once, then test the same production artifacts. Do not rewrite generated files or install dependencies during browser measurements.
- Findings include reproduction/evidence and acceptance criteria. A passing prior run does not establish the current install is correct.
- Existing uncommitted changes are preserved. Commit/release actions remain separate from this task.

## Current batch

| ID | Priority | Work | Owner / files | Done when | State |
| --- | --- | --- | --- | --- | --- |
| R1 | P1 | Review the uncommitted hardening changes | Review agent: `docs/RELEASE-REVIEW.md` | Material defects, reproductions, and required checks recorded | Review complete; dependency-chain and package-manager findings resolved |
| R2 | P1 | Resolve preview dependency through the actual EmbedPDF dependency chain | Coordinator: preparation script + validator tests | Regression fails on original mixed install, then actual engine-resolved validators pass after preparation | Fixed; actual engine-resolved validator suite passes (54 tests) |
| R3 | P1 | Choose one package manager and reconcile dependency resolution | Coordinator: package/lock/CI/docs | Clean canonical install resolves reviewed matcher release and full checks pass; no conflicting lockfile policy | Done: pinned pnpm 10.33.4; clean frozen install and all checks pass |
| P1 | P1 | Measure real browser opening/navigation/memory behavior | Performance agent: `scripts/performance/`, `docs/PERFORMANCE.md` | Reproducible production-browser measurements using real PDFs, with environment/method/caveats | Measured isolated npm candidate: 12 observations; 388 ms stall exceeds target; final baseline follows R3 |
| L1 | P1 | Apply project MIT license | Coordinator: `LICENSE`, package metadata, README | Project license recorded without relicensing third-party material | Done: user chose MIT; LICENSE and package metadata added |
| L2 | P1 | Inventory and publish verified third-party notices | Notices agent: `public/THIRD-PARTY-NOTICES.txt`, `public/licenses/`, `docs/NOTICES.md` | JS, fonts, PDFium/WASM and vendored CSS notices traced to actual distribution; gaps explicit | Done: exact-source native inventory independently reviewed; 64 native public hashes and original 43 source hashes verified |
| H1 | P2 | Compare static hosting options | Coordinator: `docs/HOSTING.md` | Concrete provider choices, build/output/base-path settings, worker/WASM requirements and release checks | Done: Cloudflare selected; configuration and local runtime verified |

## Release gate

| ID | Priority | Work | Owner | Done when | Dependencies |
| --- | --- | --- | --- | --- | --- |
| V1 | P1 | Repeat clean install, unit tests, lint, type checks and build | Coordinator | Actual current tree passes, including validator and glob-resolution regressions | R2, R3 |
| V2 | P1 | Repeat production browser/corpus checks | Verification agent | Chromium/Firefox/WebKit core flows pass on final artifacts; 15-file corpus expectations hold | V1 |
| V3 | P1 | Smoke-test actual Safari | Manual verification / coordinator where available | File open, references, decoding, preview, replacement, dialog focus checked in Safari itself; evidence recorded | V1 |
| H2 | P1 | Prepare chosen hosting configuration | Coordinator | Preview deploy serves JS/workers/WASM/fonts with correct paths, MIME types and caching | Hosting choice, L2, V1 |
| H3 | P1 | Public release verification | Coordinator | Published URL passes local-file exploration, no document uploads, notice access, and asset-loading checks | H2, V2, V3 |
| U1 | P2 | Observe an unfamiliar developer using the app | User + coordinator | Developer finds a page stream and resource reference without coaching; friction recorded | Shareable preview |

## Product follow-up, after measurements

| ID | Work | Why / acceptance |
| --- | --- | --- |
| F1 | Profile large-document main-thread ingestion, then evaluate lazy object retrieval | Next engineering priority: the 85,334-object file produces a 388 ms main-thread stall. Trace the final worker message and React commit before selecting an implementation. Preserve source provenance and reference correctness. |
| F2 | Evidence-based resource budgets | Tune file/object/decoded limits using browser measurements and target-device coverage. Keep failure states explicit. |
| F3 | Broader current-producer corpus | Add untouched current browser, Office, design-tool and scanner outputs; preserve source rights and independent oracle checks. |
| F4 | Upstream-supported inspection API | Evaluate retiring pinned LibPDF internals, or extending EmbedPDF upstream, with the same object/stream/source-range contract. This is separate research, not a release dependency. |
| F5 | Upstream preview validation fix | Retire the local backport only after a compatible upstream version passes its existing behavior tests, including bundled copies. |

## Decisions

- Project source license: MIT, selected by the user.
- Hosting: Cloudflare Workers Static Assets selected by the user; the verified public app is at https://pdf-internals-viewer.pricepaiddata.workers.dev.
- Package manager: pnpm 10.33.4, authorized by the user; `pnpm-lock.yaml` is the only lockfile. CI uses frozen installs and caches the pnpm store.
- Public PDF assets: keep only original bundled samples; the third-party corpus stays in ignored local cache.

## Evidence and immediate next tasks

- [Release review](RELEASE-REVIEW.md): actual preview dependency-chain bug fixed, with regression evidence; clean pnpm installation now passes the reviewed consumer and validator regressions.
- [Performance report](PERFORMANCE.md): large-file median opening ~2.03 seconds; cached navigation below 43 ms; maximum measured main-thread long task 388 ms. Heap figures are snapshots, not peak or total memory.
- [Notice inventory](NOTICES.md): verified JS/font/CSS notices prepared; the native gap is closed with an independently reviewed conservative exact-source/toolchain inventory. The [historical supplier request draft](PDFIUM-NOTICE-REQUEST.md) was not sent.
- [Hosting options](HOSTING.md): Netlify, Cloudflare Workers Static Assets, and GitHub Pages compared with concrete build/path requirements. Cloudflare is selected and the app is live at https://pdf-internals-viewer.pricepaiddata.workers.dev.

The coordinator validated an isolated npm-lock candidate without deleting the root pnpm installation: clean install, 82 unit tests, lint, type checking and production build passed. This is evidence for that candidate, not a claim that the current mixed root installation is reconciled. No file/object limits were raised.

The modification-banner gate is verified in the isolated npm build: `postbuild` checks emitted preview workers/inline/fallback payloads read-only, with legal comments preserved before hashing.


## Clean pnpm verification — 2026-11-12

R3, V1 and V2 are complete for this batch. A fresh pinned-pnpm frozen install ran both preparation hooks. The root tree passed 82 unit tests, 15 corpus tests, lint, type checking, production build and emitted-notice checks. The same production artifacts passed all 27 browser checks (9 each in Chromium, Firefox and WebKit). All 43 recorded dependency notice-source hashes matched. No conflicting npm lockfile remains.

The earlier performance observations remain labeled as historical npm-candidate measurements; a pnpm performance baseline is still separate follow-up work. Actual Safari testing, the native PDFium notice gap and public deployment remain open.


## Cloudflare setup — 2026-11-12

H2 configuration and local verification are complete: pinned Wrangler, assets-only configuration, explicit 404 handling, caching/MIME checks, 82 unit tests and 27 browser tests against the Cloudflare local runtime pass. The existing OAuth session is authenticated. CI runs a deployment dry run; automatic publishing is not enabled. The remaining native dependency notice bundle still prevents completing L2 and the public launch gate. H3 awaits the first actual deployment URL.


### Preview retained for launch

The user chose to keep page preview and finish the native notices before publishing. Work is reconstructing a conservative notice inventory from the pinned PDFium source/dependency revisions and Emscripten 3.1.72, with independent review of nested license exceptions and required acknowledgments. A new `check:native-notices` pre-deploy gate rejects incomplete inventories or a changed WASM hash. Cloudflare's API confirms the proposed `pdf-internals-viewer` Worker does not exist, so the first deployment will create it rather than replace an unrelated app.


### Native notice preparation completed

The reconstructed source-matched inventory is independently reviewed: 20 component groups, 64 hashed public notice/evidence files, 148 HarfBuzz comment blocks and 1,768 Emscripten comment blocks. All external archive object names map to exact dependency sources; component review additionally covers header-only/amalgamated code and nested license exceptions. Native notices remain a conservative source superset, not a supplier-issued SBOM. The release verifier now binds the inventory to the installed and built WASM and built public notice files. L2 is complete for this stated inventory.


### Public preview deployed — 2026-11-12

H2 and hosted verification in H3 are complete. URL: **https://pdf-internals-viewer.pricepaiddata.workers.dev**; Cloudflare version `bc262a96-3a5e-488c-a0df-f02188f6ea67`. Live checks verified matching HTML, all 64 native notice/evidence file hashes, the combined bundle, exact WASM, worker/font/WASM MIME types, cache behavior and missing/private-path 404s. The live browser suite passed 27/27 in 36.7 seconds after the managed-local suite passed 27/27. Preview is retained. Native notice preparation uses the reviewed conservative source/toolchain inventory; no supplier response was required or claimed. Actual Safari testing (V3), performance follow-up and the observed developer session remain open. A custom domain is optional; automatic deployment on merge is not enabled.
