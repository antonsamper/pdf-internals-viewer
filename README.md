# PDF Internals Viewer

A read-only PDF explorer built with TypeScript, React, Vite, and shadcn/ui using Base UI. Open a local PDF, follow object references, inspect raw/decoded streams, and view original bytes alongside the structure. EmbedPDF provides an optional local page preview.

## Run locally

Requires Node.js 22.18+ (or a compatible newer release) and npm.

```sh
npm ci
npm run dev
```

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
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The parser tests cover classic/stream/hybrid xrefs, compressed objects, incremental updates and free entries, exact object boundaries, deceptive binary markers, required decoding filters, encryption, recovery, references, and bounded decompression. Browser tests cover the integrated exploration flow and local rendering.

`npm run build` produces the static site in `dist/`. `npm run preview` serves the built site locally. No hosting provider or public deployment is configured yet.

## Public-facing limitations

**About & limitations** is always available in the footer, including on mobile. The opening screen also links to it before a file is loaded. The scrollable dialog describes supported files/filters, encrypted-file behavior, source fidelity, preview/search truncation, browser coverage, resource limits, and local processing. It never opens automatically or requires acknowledgment.

## Parser and preview

The inspection adapter uses a pinned **@libpdf/core 0.5.3** TypeScript engine. Its low-level parsers are not publicly exported. A deterministic build script exposes the required existing parsers in a generated, gitignored module, verifying the exact source hash and preserving the upstream MIT license. It does not mutate `node_modules` or rewrite the user's PDF. `npm ci` generates the adapter automatically; upgrades require explicit compatibility work. See [parser capability notes](docs/PARSER.md).

Preview is lazy-loaded and uses **EmbedPDF 3.1.0**, whose PDFium engine runs as WebAssembly in a worker. Worker/WASM assets are served by the application build, with no CDN or cloud engine. See [preview notes](docs/PREVIEW.md).

## Limits and current gaps

This is a working first implementation, not a completed release of every item in [the plan](docs/PLAN.md).

- 64 MiB input limit, 100,000 indirect-object limit, 15-second worker-operation timeout.
- 32 MiB decoded stream limit and 128 MiB total decoded allocation budget; displayed source/stream previews are capped at 256 KiB.
- Object indexing is currently eager within the worker, not incremental/lazy. Very large graphs can still consume substantial memory beyond the decoded-data budget.
- Encrypted PDFs expose original bytes and a locked state. Password entry is not implemented.
- Decoded inspection supports Flate (including tested PNG predictors), ASCIIHex, ASCII85, and chains of those filters. Unsupported filters keep raw inspection available.
- Recovered structure and unknown positions are labeled. Decoded positions are never presented as original file offsets. Dictionary order/duplicates and exact string spellings are not guaranteed by the semantic inspector; original bytes remain authoritative.
- Historical object revisions, precise rendered-content-to-byte mapping, extracted text search, editing, repair, persistence, and comparison are deferred.
- Dependency audit findings remain in the initial toolchain and EmbedPDF's transitive Zod dependency. See [dependency audit notes](docs/DEPENDENCIES.md) before any public release. Do not force incompatible major-version overrides to silence the audit.
- Automated browser checks currently target Chromium; Firefox/Safari compatibility and the planned performance baseline still need broader validation.

## Sample provenance and licensing

The bundled PDFs are generated from original fixture definitions in `scripts/fixtures/pdf-fixtures.mjs`; no third-party documents are included. Regenerate them with `node scripts/fixtures/generate.mjs`. Their text uses standard PDF fonts. Dependency licenses remain with their respective authors; the generated adapter preserves the upstream license. A project-wide license has not yet been selected.
