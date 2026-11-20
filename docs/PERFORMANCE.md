# Browser performance baseline

## Implemented batching and shared indexes — 2026-11-15

The implementation removes the measured large-file stalls using an acknowledged batch protocol and worker-computed resource/download indexes. It retains the complete object graph in the browser: object details are not yet fetched lazily. Source bytes, source ranges, typed values, reference paths and search remain unchanged. No dependencies or limits were changed, and nothing was published.

The worker sends up to 128 items per response, targeting 128 Ki characters of JSON-estimated payload size. Each item is a document summary, complete object record, download-index entry or resource-index entry. Actual messages use structured cloning to preserve optional fields and numeric values, including negative zero; JSON is used only to estimate batch size. Acknowledgements keep one response in flight and separate ingestion into browser tasks. One oversized record/summary is sent alone rather than truncated, so this is not a hard per-object size or main-thread-time guarantee. Full lazy values remain an option for unusually large individual records and memory reduction.

Download discovery and resource classification run once in the worker. Resource rows carry object IDs rather than duplicate records; the UI and inspector reuse the transferred indexes. React receives a complete document only after the last batch. Closing, replacement and timeouts still terminate the document's worker and discard the in-progress graph.

### Repeated production baseline

Same environment, fixtures and procedure as the pre-change baseline below: three contexts per file, five catalogue visits per context, unthrottled localhost, no tracing or message probes. All 12 openings and 60 navigations completed without runtime errors.

| Corpus ID | Open ms, median | Navigation ms, median | Max navigation ms | Opening long tasks ≥50 ms | Max RAF gap ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 86.3 | 31.2 | 37.4 | 0 | 16.8 |
| pdfjs-bug1937438_from_word | 86.2 | 31.4 | 39.1 | 0 | 16.8 |
| pdfjs-tracemonkey | 146.5 | 31.5 | 40.7 | 0 | 16.8 |
| pdf-lib-linearized_with_object_streams | 2212.0 | 31.7 | 45.5 | 0 | 16.8 |

For the 85,334-object file, the previous maximum long task was 399 ms; no task reached Chromium's 50 ms reporting threshold after this change. Maximum catalogue navigation fell from 123.3 to 45.5 ms; every measured navigation is below 100 ms. The opening-related main-thread target also passes for these files. Large-file median opening increased from 2146.8 to 2212.0 ms (about 3%); responsiveness improves while total opening time remains similar. The representative 10 MiB target and lower-memory device validation remain open.

After-open large-file used-heap medians were 132.36 MiB on the main page and 152.13 MiB in the parser worker, versus 136.62 / 133.00 MiB before. The worker snapshot increased; these unforced-GC samples include temporary allocations and are not retained-heap or peak-memory measurements. This change makes no memory-reduction claim. Keep the current file/object/decoded-data safeguards.

The evidence records application/worker asset hashes as well as the unchanged pnpm lock fingerprint.

Validation: 155 unit tests, 15 pinned corpus checks, lint, type checking, production build and postbuild gates pass. All 144 production-preview browser checks pass (48 each in Chromium, Firefox and WebKit), including a deterministic replacement while an acknowledgement is held. Transport tests cover compressed-object provenance, source/value fidelity, shared indexes, Unicode, special numeric values, oversized records, cancellation between batches, subsequent errors and timeouts. The native Node corpus probe needed an existing extensionless `limits` import changed to `limits.ts`; this does not change parser behaviour. Actual Safari is still a separate manual check.

The baseline command below reproduces this implementation when run against its build. Earlier baseline, profiles and recommendations are retained below as the evidence that led to this implementation.

### Pre-PR verification

Fresh unit, corpus, lint and build checks pass.

A fresh production rebuild and uninstrumented 12-opening / 60-navigation run reconfirmed the result before creating the PR: large-file median opening 2220.5 ms, maximum catalogue navigation 44.4 ms, no opening long task ≥50 ms and maximum opening RAF gap 16.8 ms. Large-file after-open heap medians were 131.49 MiB (main) / 155.34 MiB (worker), with the same unforced-GC limitations. The conclusions above are unchanged.

The rebuilt index fingerprint is `141cfb19db8a2251cec523b17760869c51a39fa9e31b0dadd4c9c27a8e14f4fc`; content-scanned CSS and its importing chunks changed since the first improved run, while the parser-worker hash is unchanged.

## Current pnpm baseline — 2026-11-15

Pre-implementation evidence: P1 baseline refresh and F1 bottleneck investigation were complete at this point. No application behaviour, dependencies, or limits had changed. The implementation and its repeated measurements are recorded above.

Measured a clean `pnpm 10.33.4 install --frozen-lockfile` followed by `pnpm run build`, including all postbuild checks. The same production artefacts were served throughout baseline, tracing, and diagnostic runs. Chromium 158.0.8127.18, Node v22.23.2, Apple M2 Pro, 10 logical CPUs, 32 GiB RAM, darwin/arm64, headless 1440 × 1000, localhost, no throttling.

- Production index SHA-256: `a7df1d50d2d39f583acd30ad85e2a9ef61f922aff78fabdea6da7dde2a52eac5`.
- pnpm lock SHA-256: `4f59568caaa9dc6837907d2e6e0e88ef98450cc7c93bdf0085458f5b1672a3c0`.

### Unprofiled production measurements

Three fresh contexts per file; five catalogue visits per context, with Overview between visits. All 12 openings and 60 navigations completed without page runtime errors. Medians unless labelled maximum.

| Corpus ID | Open ms | Navigation ms | Max navigation ms | Max main long task ms | Max RAF gap ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 91.0 | 31.3 | 42.6 | 0 | 49.9 |
| pdfjs-bug1937438_from_word | 99.0 | 31.4 | 40.7 | 0 | 16.7 |
| pdfjs-tracemonkey | 131.6 | 31.2 | 44.9 | 0 | 16.8 |
| pdf-lib-linearized_with_object_streams | 2146.8 | 93.0 | 123.3 | 399 | 383.4 |

The large document contains 85,334 objects, including 83,804 compressed objects, in 4,019,135 original bytes. Every large-file opening produced two long tasks: 382–399 ms followed by 126–129 ms. The first catalogue visit per context took 121.2–123.3 ms; later visits took 90.1–95.6 ms. Thus the 100 ms navigation ceiling fails even though its median passes. The representative 10 MiB / three-second opening target remains untested because the corpus has no such file.

After-open median memory snapshots (MiB; no forced GC):

| Corpus ID | Main used JS heap | Main backing storage | Worker used JS heap | Worker backing storage |
| --- | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 6.55 | 0.88 | 1.81 | 2.03 |
| pdfjs-bug1937438_from_word | 6.39 | 0.92 | 2.86 | 2.08 |
| pdfjs-tracemonkey | 9.86 | 1.85 | 6.17 | 3.01 |
| pdf-lib-linearized_with_object_streams | 136.62 | 4.71 | 133.00 | 11.33 |

These are separate isolate snapshots, not peak or whole-browser memory. They exclude optional preview/WASM and other allocations; retain the current safeguards.

### Large-file bottleneck evidence

Three additional runs used CDP timeline tracing and main-page CPU sampling, on the same minified production build. Their timings are diagnostic and excluded from the baseline above.

| Run | Worker-response JS callback ms | Following React scheduler callback ms | Download discovery sampled inclusive ms | Object-map construction sampled inclusive ms |
| --- | ---: | ---: | ---: | ---: |
| 1 | 404.9 | 133.9 | 79.9 | 12.8 |
| 2 | 400.1 | 135.3 | 79.3 | 14.2 |
| 3 | 398.4 | 129.6 | 74.7 | 13.3 |

The timeline places the longest main-thread task in `PdfWorkerClient`'s response handler (`src/lib/pdf/client.ts`), before the separate React scheduler task. CPU sampling attributes roughly 338–340 ms of self time to that handler. Its production body only reads `event.data`, finds the pending request, clears its timeout and resolves the promise. To isolate the expensive part, three further diagnostic runs installed a Worker message listener before the application listener and timed the first `event.data` read. Those reads took **384.4, 384.0 and 388.3 ms**, each receiving all 85,334 records. This confirms Chromium's lazy structured-clone deserialisation as the dominant main-thread stall. Reading the data in a preceding listener shifts where that work appears; it does not remove it or provide a new baseline.

The later scheduler callback includes React rendering and application computations; its full duration is not a React commit-only measurement. The sampled download-discovery frames map to `embeddedDownloads` in `src/lib/pdf/downloads.ts` (production symbol `mg`, line 422, column 19500). Object-map construction maps to `App.tsx`'s `new Map(objects.map(...))` (line 446, column 15971). The exact positions apply only to `main-B47Yb-0W.js`. Inclusive samples include descendant calls and are approximate; do not add them to callback durations. The largest observed main-thread layout event in the first trace was 3.7 ms, so layout does not explain either large stall.

Worker-side traces include parsing and response posting, but do not separately time `self.postMessage` serialisation. The worker retains complete records and `PdfInspector.open` returns all of them in `document.objects`; `pdf.worker.ts` posts the full document. No worker serialisation-only duration is claimed.

### Implementation recommendation and acceptance

1. Prioritise the worker response contract: send lightweight document/object summaries, retrieve full values on demand, and bound/paginate messages. Moving parsing to a worker or virtualising rows alone cannot avoid the measured full-tree deserialisation. Measure each batch; a single lightweight response can still be too large.
2. Keep reference/resource indexing in the worker, or perform it in cancellable batches, and reuse its results across the overview, resource browser and inspector. `resourceCatalog` currently calls `embeddedDownloads` during opening; `ObjectInspector` independently memoises another full-document scan when mounted. Profile the first catalogue visit separately before attributing its exact cost.
3. Preserve object IDs, reference paths, incoming-link completeness, original/decoded provenance, history, cancellation and document replacement. Keep the 64 MiB and 100,000-object safeguards. Lazy retrieval changes the current synchronous object-map contract, so account for unavailable/loading details explicitly.

Acceptance for the next implementation: repeat these same unprofiled 12 openings and 60 navigations; no opening-related task over 100 ms and every measured catalogue navigation below 100 ms; verify provenance/reference/history/replacement behaviour with the existing unit/corpus/browser checks. Record both main and worker heaps with the same caveats. Add a representative 10 MiB file separately before declaring the opening-size target passed. Repeat on lower-memory target devices before changing limits.

### Reproduce current evidence

After installation, corpus fetch and production build, run `pnpm run preview --host 127.0.0.1 --port 5174 --strictPort`. Keep that build fixed throughout the following sequential runs:

```sh
PERFORMANCE_OUTPUT=.context/browser-performance-pnpm.json PERFORMANCE_BUILD_LABEL='pnpm 10.33.4 production' node scripts/performance/browser-baseline.mjs

PERFORMANCE_FILES=pdf-lib-linearized_with_object_streams PERFORMANCE_PROFILE_DIR=.context/performance-profiles PERFORMANCE_OUTPUT=.context/browser-performance-profiled.json node scripts/performance/browser-baseline.mjs

PERFORMANCE_FILES=pdf-lib-linearized_with_object_streams PERFORMANCE_PROBE_MESSAGES=1 PERFORMANCE_OUTPUT=.context/browser-performance-message-probe.json node scripts/performance/browser-baseline.mjs
```

`PERFORMANCE_PROFILE_DIR` saves one `.trace.json` (DevTools Performance import) and one `.cpuprofile` (JavaScript CPU profile) per opening, stopping before navigation. `PERFORMANCE_PROBE_MESSAGES=1` adds the first-read listener described above. Both are opt-in diagnostics and should be run separately from the uninstrumented baseline. Reports mark these modes explicitly. Neither changes built files. No deployed site was changed.

## Recorded results

They do not measure the current pnpm installation.

Environment: Chromium 158.0.8127.18, Node v22.23.2, darwin/arm64, Apple M2 Pro, 10 logical CPUs, 32 GiB system RAM, 1440 × 1000 headless viewport, localhost with no CPU/network throttling.

Production index SHA-256: `8c5848f33cc9fe5cc56192827b6637299d505bab7e76d2a8a25dbc7db2a68a2e`. The candidate predates the planned licence-banner/notices update; comment-only changes do not establish a new measured baseline.

Three fresh contexts per document; five catalogue navigation measurements per context. Values are medians unless labelled maximum.

| Corpus ID | Open ms | Navigation ms | Max navigation ms | Max main long task ms | Max RAF gap ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 81.7 | 31.4 | 37.6 | 0 | 33.2 |
| pdfjs-bug1937438_from_word | 88.6 | 31.0 | 42.3 | 0 | 16.8 |
| pdfjs-tracemonkey | 135.0 | 30.3 | 42.9 | 0 | 16.7 |
| pdf-lib-linearized_with_object_streams | 2026.4 | 31.6 | 40.5 | 388 | 383.3 |

No Long Task entry was observed for the first three documents; none of the observed tasks met Chromium's 50 ms reporting threshold. Smaller tasks still used the main thread. The large case recorded a 380 to 388 ms main-thread task in every run. Its animation-frame gap reached 383.3 ms.

### After-open memory snapshots

These median CDP `Runtime.getHeapUsage` snapshots show MiB used by the main-page and parser-worker isolates separately. They exclude other allocations, including embedder memory and the optional PDFium/WASM preview. They measure neither whole-browser nor peak memory. The script did not force GC.

| Corpus ID | Main used JS heap | Main backing storage | Worker used JS heap | Worker backing storage |
| --- | ---: | ---: | ---: | ---: |
| pdfjs-helloworld | 5.96 | 0.77 | 1.86 | 1.92 |
| pdfjs-bug1937438_from_word | 5.88 | 0.81 | 2.48 | 1.97 |
| pdfjs-tracemonkey | 8.78 | 1.74 | 7.63 | 2.90 |
| pdf-lib-linearized_with_object_streams | 142.03 | 4.60 | 140.02 | 11.23 |

### Interpretation and next work

- Cached navigation target: all 60 observations stayed below the planned 100 ms threshold; maximum 42.9 ms. This particular catalogue navigation is inexpensive even after opening the large file. It is not proof that every dictionary, decoded stream, or search interaction is below 100 ms.
- Opening target: the 4.0 MB / 85,334-object case became indexed and paint-ready in about 2.03 seconds. The planned representative 10 MiB target remains untested because this corpus has no document of that size.
- Responsiveness target: failed for the large-object case. A 388 ms main-thread task exceeds the planned 100 ms ceiling. Next, profile how the app receives the final worker message, converts objects for transfer and back, and applies React updates to the page. Identify which function takes the most time.
- Memory: even this 4.0 MB file retained about 142 MiB main JS heap and 140 MiB parser-worker JS heap after opening, with additional backing-store and embedder allocations. Retain the existing safeguards while evaluating lazy object retrieval and incremental indexing; file size alone is not a useful heap estimate.
- Baseline scope: these are local absolute measurements. There is no earlier browser baseline, so no improvement/regression claim is made. Repeat on representative lower-memory devices and public hosting before tuning limits.

Raw observations are saved in ignored `.context/browser-performance.json`. The script does not modify application behaviour, package files, or resource limits.

## Reproduce

Use the project’s pinned package manager for a clean installation and production build. Serve `dist/` locally, for example with the project's `preview` script on port 5174. Do not build or regenerate dependency/parser files while the run is active.

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

The last case contains 83,804 compressed objects. The upstream document has not been padded to increase its size. Files remain in the ignored corpus cache and are verified against the manifest SHA-256 before the browser opens them.

Optional environment settings:

- `PERFORMANCE_BASE_URL`: already running production site.
- `PERFORMANCE_DIST_DIR`: production directory to fingerprint, default `dist`; the script rejects a served index that differs.
- `PERFORMANCE_BUILD_LABEL`: label such as `pnpm 10.33.4 production build`.
- `PERFORMANCE_RUNS`: repetitions from 1 through 10.
- `PERFORMANCE_FILES`: comma-separated corpus IDs.
- `PERFORMANCE_OUTPUT`: output JSON path, default `.context/browser-performance.json`.

## Method

Every observation uses a fresh Chromium browser context at 1440 × 1000, headless, with no CPU or network throttling. Contexts are closed after each document. A failure is recorded and the context is closed; opening is bounded by a 25-second wait and the application's own worker-operation timeout.

The fingerprint identifies the measured build even when the workspace contains uncommitted changes. The recorded local machine is Apple M2 Pro, 10 logical CPUs, 32 GiB RAM, macOS/arm64; the script records the environment it actually runs on.

Measurements:

- Opening to ready: from the file-input `change` event to the indexed status appearing plus two animation frames. This includes browser-side file reading, parsing, worker-to-main transfer, React rendering, and paint opportunity. It excludes the user's file-picker interaction and host test-driver overhead before the input event.
- Cached object navigation: click on Document catalogue to its object heading rendering plus two animation frames, repeated five times with Overview between selections. These are visible application timings, not parser-only function times. Two frame intervals impose a small measurement floor.
- Responsiveness while opening: actual Long Task entries, their maximum duration, and animation-frame gaps. The report records whether Long Task observation is supported; an unsupported observation does not count as zero work. RAF gaps include scheduling, GC, and other contention; they do not by themselves identify a source function.
- Startup: Navigation Timing, paint entries, LCP observations, individual resource sizes/timings, before document opening.
- Memory snapshots: CDP `Runtime.getHeapUsage` on the main page and parser-worker target after opening. JS used/allocated heap, external/backing storage, and embedder fields are retained as separate values if the browser provides them. Missing worker access is reported as unavailable.

The script does not force garbage collection. Memory snapshots are not peak browser memory, process RSS, or a total application memory cap. Heap and backing storage measure different things from PDF file size, the decoded-data budget, and PDFium/WASM allocations. Keep these figures separate. The baseline does not open the optional preview renderer.

Localhost transfer sizes and timings do not establish public-hosting or mobile-network performance. No previous browser baseline exists, so this is an absolute baseline, not evidence of improvement or regression.

## Acceptance targets and limitations

The planning targets were: a representative 10 MiB PDF navigable within three seconds, cached object navigation below 100 ms, and no parsing-related main-thread stall over 100 ms. The current corpus has no representative 10 MiB document, so that opening target cannot be marked passed from these four files. Navigation met its target in these cases; the large-object opening failed the main-thread stall target as detailed above.

Do not raise or remove the 64 MiB or 100,000-object safeguards from a single-machine baseline. The next implementation task should follow actual bottleneck evidence: if final worker serialisation and main-thread ingestion dominate, consider lazy object retrieval and incremental reference indexing before increasing limits. The measurement script does not alter these limits or application behaviour.
