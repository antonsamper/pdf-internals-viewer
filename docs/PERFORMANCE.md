# Browser performance

`scripts/performance/browser-baseline.mjs` opens real PDFs from the [corpus](CORPUS.md) in a production build with headless Chromium. It measures how long each takes to become usable, how fast navigation is afterwards, whether the page stalls while opening, and how much JavaScript heap is used. [PARSER.md](PARSER.md) describes how the worker delivers a document to the page.

## Targets

- A representative 10 MiB PDF becomes navigable within three seconds. The corpus has no file that large (its largest is about 4 MB), so this is not yet measured.
- Cached object navigation takes under 100 ms.
- No main-thread stall over 100 ms while a document is parsed and delivered.

The safeguards in `src/lib/pdf/limits.ts` (file size, object count, decoded data, timeout) should not be raised on the strength of one machine's numbers.

## Running the harness

```sh
pnpm exec playwright install chromium
pnpm run corpus:fetch
pnpm run build
pnpm run preview --host 127.0.0.1 --port 5174 --strictPort
```

Then, in a second terminal:

```sh
node scripts/performance/browser-baseline.mjs
```

The script checks each corpus file's hash and refuses to run if the served build differs from `dist/`, so do not rebuild while the server is running. Close other heavy work first. It writes its report to `.context/browser-performance.json`, a gitignored path.

`PERFORMANCE_*` environment variables, read at the top of the script, choose the files, number of runs, server and output path, and turn on diagnostics: retained-memory mode, memory budgets, CPU profiles and message timing. Take timings only from a run with no diagnostics enabled, because they add work to the opening.

Each opening is timed from choosing the file until the document's object count appears, plus two animation frames. Navigation is five timed clicks on **Document catalogue**. Heap figures are JavaScript heap samples, not total browser memory, and exclude the PDFium preview.

## Current baseline

Recorded on 20 November 2026 on an Apple M2 Pro (10 cores, 32 GB) running macOS 26.6.2, with headless Chromium 158.0.8127.18. Three runs per file, no diagnostics:

| Corpus ID | Median opening (ms) | Max cached navigation (ms) |
| --- | ---: | ---: |
| `pdfjs-helloworld` | 113.0 | 53.8 |
| `pdfjs-bug1937438_from_word` | 102.0 | 49.3 |
| `pdfjs-tracemonkey` | 158.8 | 53.7 |
| `pdf-lib-linearized_with_object_streams` | 2,526.9 | 56.7 |

The large file (4 MB, 85,334 objects) caused no long tasks while opening, and the largest gap between animation frames was 16.8 ms.

Retained heap for the large file, from a separate run with `PERFORMANCE_FILES=pdf-lib-linearized_with_object_streams PERFORMANCE_RETAINED_MEMORY=1` (median of three):

| Sample | Used heap (MiB) |
| --- | ---: |
| Page, after opening and navigation | 92.21 |
| Parser worker, after opening and navigation | 6.35 |
| Page, after closing the PDF | 6.15 |
