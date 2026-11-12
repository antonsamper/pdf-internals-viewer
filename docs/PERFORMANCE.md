# Browser performance baseline

Status: baseline captured on 2026-11-12. All 12 observations completed without page runtime errors. The large-object case exposes a main-thread stall beyond the planned responsiveness target; no application code or limits were changed by this measurement task.

## Recorded results

Build label: `isolated npm-lock candidate; workspace manager unresolved; pre-banner-notice update`. The root workspace package-manager choice was unresolved, so these observations use the parent-prepared isolated, clean npm-lock production candidate. They must not be presented as measurements of the current pnpm installation.

Environment: Chromium 158.0.8127.18, Node v22.23.2, darwin/arm64, Apple M2 Pro, 10 logical CPUs, 32 GiB system RAM, 1440 × 1000 headless viewport, localhost with no CPU/network throttling.

Production index SHA-256: `8c5848f33cc9fe5cc56192827b6637299d505bab7e76d2a8a25dbc7db2a68a2e`. Package-lock SHA-256: `c4277099ab4c838c9a470d69085e49372f380802318a274d4eac539e97902e69`. Source HEAD: `ad644cc82cc7bac5526d935243107924aea7e15d`, with uncommitted release work included in the candidate. The candidate predates the planned license-banner/notices update; comment-only changes do not establish a new measured baseline.

Three fresh contexts per document; five catalog navigation measurements per context. Values are medians unless labeled maximum.

| Corpus ID | Open ms | Navigation ms | Max navigation ms | Max main long task ms | Max RAF gap ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 81.7 | 31.4 | 37.6 | 0 | 33.2 |
| pdfjs-bug1937438_from_word | 88.6 | 31.0 | 42.3 | 0 | 16.8 |
| pdfjs-tracemonkey | 135.0 | 30.3 | 42.9 | 0 | 16.7 |
| pdf-lib-linearized_with_object_streams | 2026.4 | 31.6 | 40.5 | 388 | 383.3 |

No Long Task entry was observed for the first three documents; this means no observed task met Chromium's 50 ms reporting threshold, not zero main-thread work. The large case recorded a 380–388 ms main-thread task in every run. Its animation-frame gap reached 383.3 ms.

### After-open memory snapshots

The values below are median CDP `Runtime.getHeapUsage` snapshots, in MiB. They are separate main-page and parser-worker isolates, not whole-browser or peak memory. Other allocations, including embedder memory and optional PDFium/WASM preview, are not included in these columns. No GC was forced.

| Corpus ID | Main used JS heap | Main backing storage | Worker used JS heap | Worker backing storage |
| --- | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 5.96 | 0.77 | 1.86 | 1.92 |
| pdfjs-bug1937438_from_word | 5.88 | 0.81 | 2.48 | 1.97 |
| pdfjs-tracemonkey | 8.78 | 1.74 | 7.63 | 2.90 |
| pdf-lib-linearized_with_object_streams | 142.03 | 4.60 | 140.02 | 11.23 |

### Interpretation and next work

- **Cached navigation target:** all 60 observations stayed below the planned 100 ms threshold; maximum 42.9 ms. This particular catalog navigation is inexpensive even after opening the large file. It is not proof that every dictionary, decoded stream, or search interaction is below 100 ms.
- **Opening target:** the 4.0 MB / 85,334-object case became indexed and paint-ready in about 2.03 seconds. The planned representative 10 MiB target remains untested because this corpus has no such document.
- **Responsiveness target:** failed for the large-object case. A 388 ms main-thread task exceeds the planned 100 ms ceiling. Profiling the final worker-message ingestion, object serialization/deserialization, and React commit should be the next performance task. This correlation does not itself identify which function dominates.
- **Memory:** even this 4.0 MB file retained about 142 MiB main JS heap and 140 MiB parser-worker JS heap after opening, with additional backing-store and embedder allocations. Retain the existing safeguards while evaluating lazy object retrieval and incremental indexing; file size alone is not a useful heap estimate.
- **Baseline scope:** these are local absolute measurements. There is no earlier browser baseline, so no improvement/regression claim is made. Repeat on representative lower-memory devices and public hosting before tuning limits.

Raw observations are saved in ignored `.context/browser-performance.json`. The script does not modify application behavior, package files, or resource limits.

## Reproduce

After reconciling the project's selected package manager, complete its clean installation and production build. Serve `dist/` locally, for example with the project's `preview` script on port 5174. Do not build or regenerate dependency/parser files while the run is active.

Fetch the explicit, pinned corpus with `pnpm run corpus:fetch`, then run:

```sh
node scripts/performance/browser-baseline.mjs
```

The script defaults to `http://127.0.0.1:5174`, three repetitions per document, and four real upstream fixtures:

| Corpus ID | File bytes | Pages | Objects |
| --- | ---: | ---: | ---: |
| pdfjs-helloworld | 678 | 1 | 5 |
| pdfjs-bug1937438_from_word | 46,285 | 1 | 43 |
| pdfjs-tracemonkey | 1,016,315 | 14 | 996 |
| pdf-lib-linearized_with_object_streams | 4,019,135 | 206 | 85,334 |

The last case contains 83,804 compressed objects. It is a genuine upstream document, not a PDF padded to an artificial file size. Files remain in the ignored corpus cache and are verified against the manifest SHA-256 before the browser opens them.

Optional environment settings:

- `PERFORMANCE_BASE_URL`: already running production site.
- `PERFORMANCE_DIST_DIR`: production directory to fingerprint, default `dist`; the script rejects a served index that differs.
- `PERFORMANCE_BUILD_LABEL`: label such as `pnpm 10.33.4 production build`.
- `PERFORMANCE_RUNS`: repetitions from 1 through 10.
- `PERFORMANCE_FILES`: comma-separated corpus IDs.
- `PERFORMANCE_OUTPUT`: output JSON path, default `.context/browser-performance.json`.

## Method

Every observation uses a fresh Chromium browser context at 1440 × 1000, headless, with no CPU or network throttling. Contexts are closed after each document. A failure is recorded and the context is closed; opening is bounded by a 25-second wait and the application's own worker-operation timeout.

The report records actual Chromium/Node versions, CPU/platform/system RAM, viewport, production index and pnpm-lock SHA-256 (historical npm reports retain their package-lock fingerprint), build label/directory, and source HEAD. The build fingerprint matters because the workspace may contain uncommitted changes. The recorded local machine is Apple M2 Pro, 10 logical CPUs, 32 GiB RAM, macOS/arm64; the script records the environment it actually runs on.

Measurements:

- **Opening to ready:** from the file-input `change` event to the indexed status appearing plus two animation frames. This includes browser-side file reading, parsing, worker-to-main transfer, React rendering, and paint opportunity. It excludes the user's file-picker interaction and host test-driver overhead before the input event.
- **Cached object navigation:** click on Document catalog to its object heading rendering plus two animation frames, repeated five times with Overview between selections. These are visible application timings, not parser-only function times. Two frame intervals impose a small measurement floor.
- **Responsiveness while opening:** actual Long Task entries, their maximum duration, and animation-frame gaps. Long Task support is recorded rather than treating unsupported observation as zero work. RAF gaps include scheduling, GC, and other contention; they do not by themselves identify a source function.
- **Startup:** Navigation Timing, paint entries, LCP observations, individual resource sizes/timings, before document opening.
- **Memory snapshots:** CDP `Runtime.getHeapUsage` on the main page and parser-worker target after opening. JS used/allocated heap, external/backing storage, and embedder fields are retained as separate values if the browser provides them. Missing worker access is reported as unavailable.

No forced garbage collection is applied. Memory snapshots are not peak browser memory, process RSS, or a total application memory cap. Heap and backing storage should not be conflated with PDF file size, decoded-data budget, or PDFium/WASM allocations. The baseline does not open the optional preview renderer.

Localhost transfer sizes and timings do not establish public-hosting or mobile-network performance. No previous browser baseline exists, so this is an absolute baseline, not evidence of improvement or regression.

## Acceptance targets and limitations

The planning targets were: a representative 10 MiB PDF navigable within three seconds, cached object navigation below 100 ms, and no parsing-related main-thread stall over 100 ms. The current corpus has no representative 10 MiB document, so that opening target cannot be marked passed from these four files. Navigation met its target in these cases; the large-object opening failed the main-thread stall target as detailed above.

Do not raise or remove the 64 MiB or 100,000-object safeguards from a single-machine baseline. The next implementation task should follow actual bottleneck evidence: if final worker serialization and main-thread ingestion dominate, consider lazy object retrieval and incremental reference indexing before increasing limits. The measurement script does not alter these limits or application behavior.
