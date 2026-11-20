# Third-party notices

The project's own code is licensed under the Apache License 2.0. Dependency licences stay separate.

The page preview ships PDFium compiled to WebAssembly by EmbedPDF. That binary contains code from many native libraries (FreeType, HarfBuzz, ICU, libjpeg, Skia and others), but the supplier publishes no consolidated notice bundle for them. The project keeps its own notice inventory instead, reviewed against the exact sources and toolchain used to build the installed WASM. It covers every component in those sources, including ones that may not be linked into the binary.

## What is distributed

- `public/THIRD-PARTY-NOTICES.txt`: all notices in one file, linked from the limitations page.
- `public/licenses/`: the individual licence texts, the native notice bundle (`embedpdf-native-notices.txt`) and the provenance records.
- `public/licenses/native-notice-manifest.json`: the reviewed components, a hash for every notice file, and the exact WASM hash the inventory applies to.
- `public/licenses/embedpdf-runtime-provenance.json`: the commits, releases and archive hashes that tie the installed WASM to its sources.

These files are kept byte for byte as published. `.gitattributes` stops Git changing their line endings or whitespace, because the checks below pin their hashes.

## Checks

`pnpm run check:native-notices` fails if the installed WASM hash differs from the manifest, if any notice file's hash has changed, or if `THIRD-PARTY-NOTICES.txt` is missing part of the native bundle. Every production build runs it with `--dist`, which also checks the copies in `dist/`, and the CI `deploy` job runs it before publishing.

## Upgrading EmbedPDF

Any change to EmbedPDF, its PDFium fork, its toolchain or the WASM needs a fresh notice review. The check fails until it is done.

1. Identify the new runtime commit, static-library release, payload and Emscripten commit, and update `public/licenses/embedpdf-runtime-provenance.json`.
2. Gather the notice texts for the new revisions, update `public/licenses/native/`, the provenance indexes and `public/licenses/embedpdf-native-notices.txt`, and include the bundle in `public/THIRD-PARTY-NOTICES.txt`.
3. Update `public/licenses/native-notice-manifest.json`: components, file hashes, `wasmSha256`, `runtimeCommit`, `emscriptenCommit` and `bundleSha256`.
4. Update the Zod backport pins in `scripts/prepare-preview.mjs` (see [PREVIEW-VALIDATION.md](PREVIEW-VALIDATION.md)).
5. Run `pnpm run check:native-notices` and `pnpm run build`, then the browser tests.
