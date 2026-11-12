# Third-party notices

Updated 2026-11-12. Status: prepared and independently reviewed against the pinned sources and preview binary. Original application code is MIT licensed. Dependency licenses remain separate.

## Distributed materials

- `public/THIRD-PARTY-NOTICES.txt` combines the JS/CSS/font inventory, upstream attribution texts and complete reconstructed native notice bundle. The app's About & limitations dialog links to this file.
- `public/licenses/notice-sources.json` preserves the original 43 JS/font/CSS source-text hashes and references the native inventory.
- `public/licenses/embedpdf-native-notices.txt` contains the native runtime notice bundle, including explicit FreeType and Independent JPEG Group acknowledgments.
- `public/licenses/native-notice-manifest.json` records 20 component groups, 64 hashed public notice/evidence files, immutable source URLs, source and extracted-text hashes, extraction descriptions, and the exact WASM hash.
- `public/licenses/native/` contains 61 text files. Three accompanying JSON indexes record Emscripten and HarfBuzz source comment provenance and the PDFium archive/source mapping.
- `public/licenses/embedpdf-runtime-provenance.json` records the source/archive/payload chain below. The original runtime license and both matching CloudPDF NOTICE files remain separately available.

Copied source license bytes, copyright/license comment blocks, required acknowledgments and per-component license choices are preserved. `.gitattributes` prevents newline conversion or cosmetic whitespace changes to these hash-pinned notice files. The app's MIT license does not replace any dependency license.

## Exact native artifact

- Installed package: `@embedpdf/engine-runtime-wasm32@3.1.0`.
- WASM: 7,880,343 bytes, SHA-256 `7195838021c8318416117611b961614ab52eedcad585db5945681f86164e40f9`.
- [Viewer v3.1.0 manifest](https://github.com/embedpdf/embed-pdf-viewer/blob/37273d7d149f893255344f0f8e9ff7b2dfbc8057/packages/engine/runtime/engine-runtime-build.json) pins fork `aa59ce554aab55879b728dbb86714e13e5cb327f` and upstream PDFium `6688c576fd851f4159c6fae39396da50939de110`.
- [Static-library release](https://github.com/embedpdf/runtime/releases/download/runtime-aa59ce554aab55879b728dbb86714e13e5cb327f/libembedpdf-runtime-wasm32-aa59ce554.tar.gz) matches SHA-256 `0a4c947c05ae314414fb772d0fdf20a6ffbdc412194ba6ed3c49abd42170eb5c`. Its build metadata and `args.gn` identify the configuration.
- The versioned payload-key procedure identifies [finished payload d7fb709a6427d8d9](https://github.com/embedpdf/runtime-payloads/releases/download/runtime-payloads-d7fb709a6427d8d9/engine-runtime-payload-wasm32.tar.gz), archive SHA-256 `e138fe89189f7e58656ee9cdb266b963ea27a00e224ec5ac90857af1134e0890`. Its WASM is byte-identical to the installed binary.
- Emscripten 3.1.72 is pinned to [commit 437140d149d9c977ffc8b09dbaf9b0f5a02db190](https://github.com/emscripten-core/emscripten/tree/437140d149d9c977ffc8b09dbaf9b0f5a02db190).

## How the missing inventory was reconstructed

The supplier archives contained a top-level PDFium/Apache license but no consolidated native dependency notice bundle. The project gathered the missing texts from the fork's vendored code, DEPS-pinned repositories, and Emscripten toolchain sources, using the exact revisions for this binary.

The PDFium library contains 1,198 archive objects. Of these, 556 map to fork sources; all 597 distinct external object names among the remaining objects map to the pinned dependency trees. Basename collisions remain recorded as multiple candidates. Archive membership is not final linkage, and this mapping does not alone cover headers or amalgamated code.

The review also checked component metadata and nested license exceptions: FreeType's delegated BDF/PCF/fthash, gzip and copied HarfBuzz notices; HarfBuzz's Microsoft USE-shaper license and per-source copyrights; the entire ICU data/dictionary notice; JPEG attribution; and Skia path-processing and conservative nested licenses. Disabling the Skia renderer does not remove the path-processing code found in the archive.

The HarfBuzz supplement preserves 148 unique comment blocks from all 493 source/header/Ragel files in the pinned source scope. The Emscripten supplement preserves 1,768 unique blocks across system libraries, headers and JS glue, with 4,358 source occurrences checked against hashes, exact bytes and inclusive line spans. Its nine standalone license/authors files are also included.

This conservative notice inventory covers the exact sources and toolchain, including optional or unlinked components. It is not a supplier-issued SBOM, a minimal list of linked code, or a claim that every included component runs in this app. An absent object name or disabled renderer flag is insufficient evidence to exclude a component. Source downloads remain in ignored `.context/`; only notices and provenance are distributed.

Independent review verified all 64 public hashes, native source/excerpt hashes, HarfBuzz and Emscripten supplements, required acknowledgments and assembled-bundle inclusion. The review found no remaining concrete gap within this inventory's stated scope. The earlier supplier request is retained as historical draft; no message was sent or reply claimed.

## Build and release checks

`pnpm run check:native-notices` binds the reviewed inventory to the installed WASM hash and checks every recorded public file and bundle hash. `pnpm run deploy` runs this check before publishing. Production `postbuild` additionally checks the copied `dist/` manifest, files, combined notices, native bundle and built WASM.

The separate preview-notice check verifies that prominent modification banners survive minification in the standalone worker, inline transport and embedded-source wrapper/payload. Hashed assets are never rewritten after building. The original 43 JS/font/CSS texts were verified in both clean npm and pnpm layouts before this native reconstruction.

Any upgrade to EmbedPDF, its PDFium fork, its toolchain, or the WASM requires another review of provenance, dependency scope, licenses, and behavior. A compatible supplier-issued notice bundle could replace this reconstructed inventory after its source/build match is checked. A successful notice check does not suppress the separately documented Zod advisory or replace behavioral browser testing.
