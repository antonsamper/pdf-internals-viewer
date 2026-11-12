# PDF Internals Viewer

A read-only PDF explorer built with TypeScript, React, Vite, and shadcn/ui using Base UI. Open a local PDF, follow object references, inspect raw/decoded streams, and view original bytes alongside the structure. EmbedPDF provides an optional local page preview.

## Run locally

Requires Node.js 22.18+ (or a compatible newer release) and pnpm 10.33.4 (pinned in `packageManager`). Install that version with `npm install --global pnpm@10.33.4` if needed.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

`pnpm-lock.yaml` is the sole dependency lockfile. CI uses a frozen install and caches the pnpm store. Project settings enable preparation hooks and copy installed packages so the preview backport cannot modify the shared store. See [dependency setup](docs/DEPENDENCIES.md).

Open the URL printed by Vite. First launch shows an empty workspace with a file picker and three original sample PDFs. You can also drop a PDF anywhere in the app. Files are processed on your device, in memory, and are not uploaded or persisted by this application.

## Explore a PDF

1. Open a PDF or select **A simple page**.
2. Choose **First page**, then follow its `/Contents` reference.
3. Switch between **Properties**, **Source**, **Raw stream**, and **Decoded**.
4. Inspect the highlighted original file bytes on the right. Objects inside compressed object streams instead identify their container and decoded offset.
5. Use Back/Forward to retrace references, **File structure** for the trailer/xref entry point, or **Preview** to render the selected page locally.

Search supports object IDs/labels, dictionary keys, Latin-1 file bytes, hex bytes, and opt-in decoded stream byte text. Search results are capped at 500. Decoded search uses bounded stream previews and explicitly reports incomplete results; it is not rendered-text extraction.

Keyboard: Ctrl/Cmd+O opens a file; Ctrl/Cmd+K focuses search. The hex viewer supports arrow keys, Home/End, and Enter to inspect a byte's containing object. Enter offsets as decimal or with a `0x` hex prefix.

At narrower widths, use Explorer / Inspector / Original bytes tabs. Desktop panes can be resized with the separators, including via keyboard.

## Verify

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm exec playwright install chromium
pnpm run test:e2e
```

The tests cover preview-validation backports, scoped tooling compatibility, and classic/stream/hybrid xrefs, compressed objects, incremental updates and free entries, exact object boundaries, deceptive binary markers, required decoding filters, encryption, recovery, references, and bounded decompression. Browser tests cover the integrated exploration flow and local rendering. CI runs these against production builds in Chromium, Firefox, and WebKit. WebKit automation is not a full test of the Safari application. See [browser evidence and reproduction](docs/BROWSERS.md).

`pnpm run build` produces the static site in `dist/`. `pnpm run preview` serves the built site locally. No hosting provider or public deployment is configured yet.

## Independent PDF corpus

```sh
pnpm run corpus:fetch
pnpm run test:corpus
```

This opt-in suite checks 15 commit- and hash-pinned upstream PDFs against independent reader observations. Downloads stay in ignored `.context/corpus/`; third-party documents are not bundled or redistributed. Coverage includes Word, Quartz, Adobe, TeX, a scan, forms, incremental updates, damaged cross-references, encryption, and a document containing over 85,000 objects. See [the corpus report](docs/CORPUS.md) for evidence and known partial results.

## Public-facing limitations

**About & limitations** is always available in the footer, including on mobile. The opening screen also links to it before a file is loaded. The scrollable dialog describes supported files/filters, encrypted-file behavior, source fidelity, preview/search truncation, browser coverage, resource limits, and local processing. It never opens automatically or requires acknowledgment.

## Parser and preview

The inspection adapter uses a pinned **@libpdf/core 0.5.3** TypeScript engine. Its low-level parsers are not publicly exported. A deterministic build script exposes the required existing parsers in a generated, gitignored module, verifying the exact source hash and preserving the upstream MIT license. It does not mutate `node_modules` or rewrite the user's PDF. `pnpm install --frozen-lockfile` generates the adapter automatically; upgrades require explicit compatibility work. See [parser capability notes](docs/PARSER.md).

Preview is lazy-loaded and uses **EmbedPDF 3.1.0**, whose PDFium engine runs as WebAssembly in a worker. Worker/WASM assets are served by the application build, with no CDN or cloud engine. See [preview notes](docs/PREVIEW.md). Installation and build hooks also apply a version- and hash-checked validation backport to the pinned preview dependency and its bundled worker copies; see [the backport notes](docs/PREVIEW-VALIDATION.md).

## Limits and current gaps

This is a working first implementation, not a completed release of every item in [the plan](docs/PLAN.md).

- 64 MiB input limit, 100,000 indirect-object limit, 15-second worker-operation timeout.
- 32 MiB decoded stream limit and 128 MiB total decoded allocation budget; displayed source/stream previews are capped at 256 KiB.
- Object indexing is currently eager within the worker, not incremental/lazy. Very large graphs can still consume substantial memory beyond the decoded-data budget.
- Encrypted PDFs expose original bytes and a locked state. Password entry is not implemented.
- Decoded inspection supports Flate (including tested PNG predictors), ASCIIHex, ASCII85, and chains of those filters. Unsupported filters keep raw inspection available.
- Recovered structure and unknown positions are labeled. Decoded positions are never presented as original file offsets. Dictionary order/duplicates and exact string spellings are not guaranteed by the semantic inspector; original bytes remain authoritative.
- Historical object revisions, precise rendered-content-to-byte mapping, extracted text search, editing, repair, persistence, and comparison are deferred.
- Tooling advisories have been removed from this lockfile. One high-severity advisory remains tied to EmbedPDF's upstream Zod version, despite the tested local backport. The audit report is not suppressed. See [dependency remediation and remaining obligations](docs/DEPENDENCIES.md) before release.
- Automated browser checks target Chromium, Firefox, and WebKit; actual Safari and broader PDF/browser coverage still need validation. Node corpus measurements are not the planned browser performance baseline.

## Sample provenance and licensing

The bundled PDFs are generated from original fixture definitions in `scripts/fixtures/pdf-fixtures.mjs`; no third-party documents are included. Regenerate them with `node scripts/fixtures/generate.mjs`. Their text uses standard PDF fonts. Dependency licenses remain with their respective authors; the generated adapter preserves the upstream license. The project source is [MIT licensed](LICENSE). Third-party dependencies and assets retain their own licenses.

## UI tooling

The generated shadcn/ui + Base UI components are checked in. Their supporting CSS is vendored from shadcn 4.23.0 with its MIT notice, so the component-generation CLI is not part of the installed build toolchain. See `public/licenses/shadcn.txt`.

## Release work

Track agent ownership, dependencies, release gates, and pending decisions in [the shared work list](docs/WORKLIST.md).
