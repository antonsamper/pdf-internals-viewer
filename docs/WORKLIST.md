# Public release work list

Updated 2026-11-12. Use this list to coordinate the next release batch. Owners work on separate files, and one coordinating agent integrates their results.

## Working rules

- Up to three specialist agents run alongside the coordinator.
- Each agent owns named files. Only the coordinator changes application code, dependencies, lockfiles, shared production builds, or CI during this batch.
- Build once, then test the same production artifacts. Do not rewrite generated files or install dependencies during browser measurements.
- Record reproduction steps, evidence, and acceptance criteria for each finding. Repeat checks on the current installation even if an earlier run passed.
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

## Release checks

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

## UI/UX feature backlog

All six features below were requested for the worklist on 2026-11-12 and implemented locally by three parallel agents, with coordinator integration. State: implemented; not published. They are independent of completing the performance and hardening follow-ups above.

| ID | Feature | Scope / acceptance |
| --- | --- | --- |
| UX1 | Clickable exploration trail | Show the actual navigation path, such as `Page 3 → /Resources → /Font → /F1 → 18 0 obj`, with clickable earlier steps. Preserve the relationship/key used to reach each object rather than inventing a unique hierarchy for the PDF graph. Keep the trail consistent with Back/Forward and clear it on document replacement. |
| UX2 | Inline reference expansion | Expand referenced dictionaries beneath their keys without leaving the surrounding object; retain an explicit action to navigate to the full object inspector. Support collapse, keyboard operation, and bounded nesting. Mark cycles as already in the current path and show dangling/unavailable references explicitly. |
| UX3 | Pin and compare objects | Pin one object beside the current selection so users can compare page resources, font dictionaries, or image properties. Offer highlighting for added, removed, and changed keys while preserving PDF value types and provenance. Support unpinning, a usable narrow-screen layout, and clearing the comparison on document replacement. |
| UX4 | Readable content streams | Add syntax highlighting and operator explanations to decoded page/form content streams. Resolve clickable resource names in the correct page/form resource context, including inherited resources; for example, explain `/F1 12 Tf` and link `/F1` to its font. Keep original decoded bytes accessible, preserve decoded-offset labeling, and expose unsupported or ambiguous interpretation. Start with highlighting/explanations; visual click-to-object mapping is separate later work. |
| UX5 | Visual resource browser | Provide image thumbnails and useful font details, with links to their underlying objects and the pages using them. Distinguish image XObjects from form XObjects and surface unsupported previews explicitly. Generate previews locally on demand within resource limits and retain direct access to dictionaries and original bytes. |
| UX6 | Session bookmarks and notes | Star objects or original-byte ranges, optionally add short notes, and revisit them from a sidebar list. Restore the bookmarked object/range and relevant inspector representation; support editing notes and removing bookmarks. Keep the first version in memory for the current open document and clear it on close/replacement. |

These features retain local, read-only document handling and the distinction between original bytes, decoded data, and rendered previews. Existing inspector/byte-pane scroll restoration remains open as documented below.

Implementation scope: inline expansion is lazy and bounded to four reference levels; cycles and unavailable references remain navigable through explicit full-object actions. Comparison highlights typed dictionary/value differences, not stream payloads. Readable content instructions are bounded to 1,500 rows and 5,000 tokens; inline images stop interpretation, and malformed/truncated content is labelled incomplete. Shared streams expose page resource contexts; forms without their own resources leave invocation context unresolved. Image thumbnails currently support only bounded 8-bit DeviceRGB/DeviceGray decoded samples, with explicit unsupported/truncation messages. Page links mean resource availability, not proof of a drawing operation. The initial bookmarks and notes were in-memory for the current document. The follow-up adds browser-local persistence keyed by PDF content, a resizable comparison/inspector divider, and a header user guide.

Validation: 98 unit tests, lint, type checking through the production build, emitted preview/native notice checks, and 51 production-preview browser checks passed (17 each in Chromium, Firefox, and WebKit). Browser scenarios cover trail/history, lazy cyclic expansion, bookmark notes/ranges/replacement, comparison including narrow layouts, instruction/resource navigation, and local image thumbnail generation. Desktop and mobile screenshots were inspected under ignored `.context/`. This is local verification; the public deployment was not changed.

## Decisions

- Project source license: MIT, selected by the user.
- Hosting: independent Cloudflare Pages project, live at https://pdf-internals-viewer.pages.dev; previous Worker endpoints disabled.
- Package manager: pnpm 10.33.4, authorized by the user; `pnpm-lock.yaml` is the only lockfile. CI uses frozen installs and caches the pnpm store.
- Public PDF assets: keep only original bundled samples; the third-party corpus stays in ignored local cache.

## Evidence and immediate next tasks

- [Release review](RELEASE-REVIEW.md): actual preview dependency-chain bug fixed, with regression evidence; clean pnpm installation now passes the reviewed consumer and validator regressions.
- [Performance report](PERFORMANCE.md): large-file median opening ~2.03 seconds; cached navigation below 43 ms; maximum measured main-thread long task 388 ms. Heap figures are snapshots, not peak or total memory.
- [Notice inventory](NOTICES.md): verified JS/font/CSS notices prepared; the native gap is closed with an independently reviewed conservative exact-source/toolchain inventory. The [historical supplier request draft](PDFIUM-NOTICE-REQUEST.md) was not sent.
- [Hosting options](HOSTING.md): Netlify, Cloudflare Workers Static Assets, and GitHub Pages compared with concrete build/path requirements. Cloudflare Pages is selected and the app is live at https://pdf-internals-viewer.pages.dev.

The coordinator validated an isolated npm-lock candidate without deleting the root pnpm installation: clean install, 82 unit tests, lint, type checking and production build passed. That run verified only the isolated candidate; the mixed root installation was still unreconciled at that point. No file/object limits were raised.

The isolated npm build passed the modification-banner check: `postbuild` checks emitted preview workers/inline/fallback payloads read-only, with legal comments preserved before hashing.

## Clean pnpm verification: 2026-11-12

R3, V1 and V2 are complete for this batch. A fresh pinned-pnpm frozen install ran both preparation hooks. The root tree passed 82 unit tests, 15 corpus tests, lint, type checking, production build and emitted-notice checks. The same production artifacts passed all 27 browser checks (9 each in Chromium, Firefox and WebKit). All 43 recorded dependency notice-source hashes matched. No conflicting npm lockfile remains.

At this stage, a pnpm performance baseline was still pending; the earlier observations measure the historical npm candidate. Actual Safari testing, the native PDFium notice gap, and public deployment were also still open.

## Cloudflare setup: 2026-11-12

H2 configuration and local verification are complete: pinned Wrangler, assets-only configuration, explicit 404 handling, caching/MIME checks, 82 unit tests and 27 browser tests against the Cloudflare local runtime pass. The existing OAuth session is authenticated. CI runs a deployment dry run; automatic publishing is not enabled. At this stage, the missing native dependency notice bundle still blocked L2 and public launch. H3 was awaiting the first deployment URL.

### Preview retained for launch

The user chose to keep page preview and finish the native notices before publishing. The team is reconstructing a conservative notice inventory from the pinned PDFium source/dependency revisions and Emscripten 3.1.72, with independent review of nested license exceptions and required acknowledgments. A new `check:native-notices` pre-deploy gate rejects incomplete inventories or a changed WASM hash. At that point, Cloudflare's API confirmed that the proposed `pdf-internals-viewer` Worker did not exist. The first deployment would create it without replacing another app.

### Native notice preparation completed

The reconstructed source-matched inventory is independently reviewed: 20 component groups, 64 hashed public notice/evidence files, 148 HarfBuzz comment blocks and 1,768 Emscripten comment blocks. All external archive object names map to exact dependency sources; component review additionally covers header-only/amalgamated code and nested license exceptions. The native notices conservatively include a superset of the sources. They are not a supplier-issued SBOM. The release verifier now binds the inventory to the installed and built WASM and built public notice files. L2 is complete for this stated inventory.

### Public preview deployed: 2026-11-12

H2 and hosted verification in H3 are complete. Initial deployment: the now-retired Workers endpoint; Cloudflare version `bc262a96-3a5e-488c-a0df-f02188f6ea67`. Live checks verified matching HTML, all 64 native notice/evidence file hashes, the combined bundle, exact WASM, worker/font/WASM MIME types, cache behavior and missing/private-path 404s. The live browser suite passed 27/27 in 36.7 seconds after the managed-local suite passed 27/27. Page preview remains available. Native notice preparation uses the reviewed conservative source/toolchain inventory; no supplier response was required or claimed. Actual Safari testing (V3), performance follow-up and the observed developer session remain open. A custom domain is optional; automatic deployment on merge is not enabled.


### Independent Pages project — 2026-11-12

User selected Pages to avoid the shared account hostname. App is now at **https://pdf-internals-viewer.pages.dev** in its own Pages project, deployment `5660f026`, production branch `main`. The 27 local Pages checks and 27 live checks pass; asset MIME/cache/404, exact WASM and 64 native notice/evidence hashes pass. The former Worker's production and preview subdomains are both disabled, and its old production/version-preview addresses return 404. Other account projects and the shared namespace were not changed. Current scripts/config/CI/docs target Pages; no account-wide hostname is used by the app.

### Feature follow-up — navigation context

Back/Forward now records document sections and explicit original-byte ranges alongside objects and inspector tabs. Cross-reference jumps, original-byte search results, and unknown-byte selections can be retraced; unknown-byte messages are restored with their selections. New navigation after Back discards the abandoned forward branch, and document replacement clears history. Inspector and byte-pane scroll-position restoration remains open from the original feature plan.


### Page exploration and object explanations — 2026-11-13

Implemented locally; not published:

- Pages now expands content streams, resources, and annotations. Inherited resources identify their actual ancestor, and shared, cyclic, and unavailable references are explicit. Selecting a reference opens the existing inspector/bytes and records its route. Expansion and pagination survive history, section changes, and mobile pane switches; document replacement clears them.
- Object headings explain known page, catalog, page-tree, font, image, form and content-stream roles, with a fallback when a role cannot be established. Resource explanations distinguish availability from actual drawing.
- Incoming and outgoing relationships show exact dictionary keys and array indexes. Reverse links open the actual referring object without inventing a forward traversal. Relationship detail is capped at 200 paths per direction, 200 incoming objects, 5,000 inspected values per object and 32 nested levels, with incomplete results labelled.

The tree is a page-focused route through the object graph, not a unique ownership hierarchy. Branches expand on demand, lists paginate in batches of 50, and tree expansion stops after six levels while retaining full object navigation. A raw catalog tree, physical file map and rendered-content mapping remain outside this batch.

Validation: 107 unit tests, lint, production type checking/build and emitted notice checks pass. All 72 production-preview browser checks pass (24 each in Chromium, Firefox and WebKit), including inherited-resource trail ownership, forward/reverse relationship navigation, cyclic/shared/missing references, large page-list pagination, mobile expansion retention and replacement reset. Desktop and mobile screenshots were inspected under `.context/`. The public deployment was not changed.
