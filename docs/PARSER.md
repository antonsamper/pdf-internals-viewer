# Parser feasibility result

Status: working browser-oriented prototype adapter, not a declaration of full PDF compatibility.

## Selected engine

The inspection engine is **@libpdf/core 0.5.3**, a TypeScript library. It is separate from EmbedPDF's PDFium preview engine. This keeps the application and inspection adapter in TypeScript without a native parser service or a new application language.

Evaluated alternatives:

- **pdf-lib 1.17.1:** exposes useful low-level parser classes, but its physical-object scan ignores freed cross-reference entries and is insufficient on its own for this viewer's current-object/provenance contract.
- **PDF.js public API:** useful for rendering, but does not establish arbitrary indirect object enumeration and exact source spans.
- **LibPDF:** has a cross-reference-driven parser, hybrid and `/Prev` resolution, lazy objects, object streams, and stream byte views. This matches the inspection requirement more closely.
- **QPDF/WebAssembly:** remains a future alternative if the TypeScript engine reaches a material fidelity limit. It has not been introduced.

LibPDF is beta software. Its selected low-level classes exist in the distributed bundle but are not part of the public package export contract. This prototype therefore requires explicit, version-pinned build instrumentation.

## Instrumentation and reproducibility

`scripts/prepare-parser.mjs` reads the installed bundle and produces `src/generated/libpdf-inspection.mjs` and a small declaration file. Generated artifacts are excluded from version control and regenerated before development, tests, and builds.

The preparation script:

1. Requires exact version `0.5.3` and checks the unmodified bundle's SHA-256: `7b9b699034c81be2ab6af3337e0d2559df2b91b5016913b2c202cbaafc534400`.
2. Verifies expected low-level symbols and copies the bundle's runtime helper and license.
3. Exposes the engine's existing document parser, scanner, xref parser, and a few provenance helper functions. It does not rewrite PDF input or change cross-reference resolution.
4. Captures original object boundaries using the engine's parsed token locations and stream parser, not a regex scan for `obj`/`endobj` text.
5. Uses object-stream index entries and parsed tokens for decoded source coordinates. A compressed object points to its containing original stream rather than claiming a direct file range.
6. Bounds Flate decoding and decoded stream storage as described below.
7. Resolves all static external imports through the engine package's own dependency chain before relocating the bundle, supporting pnpm's isolated dependency layout. Its `lru-cache` import specifically uses the browser ESM entry to avoid Node-only diagnostics.
8. Replaces two unused optional Google Cloud signing imports with explicit unsupported-operation rejections. These signing operations are outside the read-only adapter. Vite development import analysis otherwise attempts to resolve the optional SDKs even though production tree-shaking removes them. No cloud SDK is installed or used.

Nothing in `node_modules` is changed. Upgrading the engine intentionally fails the preparation step until the instrumentation and fixture results have been reviewed. The generated module retains the upstream license; the engine dependency and lockfile remain the source of truth. A future upstream low-level export would remove much of this instrumentation.

The generated adapter's access to token lookahead fields is a maintenance dependency, not a stable public API. Its provenance tests are mandatory when the engine changes.

## Verified capabilities

These are fixture-backed observations rather than claims about every possible PDF.

| Capability | Evidence |
| --- | --- |
| Classic xref tables | Minimal and resource-rich samples enumerate correct objects |
| Ordinary object ranges | Ranges match independently recorded fixture offsets, including object terminators |
| Binary stream boundaries | Fake `endstream`, `endobj`, and object headers inside a stream do not create false objects when `/Length` is valid |
| Cross-reference streams | Compressed sample opens through its xref stream |
| Object streams | Four compressed objects resolve with decoded ranges and original container links |
| Hybrid xref | Supplementary xref stream resolves compressed objects alongside a classic table |
| Incremental updates | Updated object wins; object freed in the latest xref is absent |
| Reference graph | Outgoing/incoming links, cycles, and dangling references are retained |
| Stream decoding | Flate, PNG predictor, ASCIIHex -> Flate chain, and ASCII85 verified |
| Encryption state | Encrypted fixture returns locked state rather than unreadable semantic objects |
| Invalid xref recovery | Truncated xref recovers objects with an explicit recovered warning |
| Input immutability | Original bytes unchanged after parsing/decoding |
| Decompression bound | 33 MiB decoded Flate fixture is refused while raw stream access remains available |

`tests/parser.test.ts` currently covers these behaviors. Test count can change as cases are added.

The three bundled sample PDFs are generated by `scripts/fixtures/generate.mjs`, from original project-owned content with no external fonts or images. Their page count, page content, and compressed-object count were independently checked with pypdf 6.14.2. Poppler's `pdftotext` also extracts the compressed sample's expected text. Fixture expected offsets are recorded when constructing the bytes, not calculated by the inspection engine under test.

## Memory and execution limits

- 64 MiB input limit and 100,000 non-free cross-reference entries.
- 32 MiB decoded limit per stream. Flate uses a streaming inflater with 64 KiB output chunks, aborting when the limit is crossed instead of assembling a complete oversized result.
- 128 MiB cumulative decoded-data budget per worker/document. The engine's stream decoder is wrapped in a shared weak cache so repeated requests and object-stream provenance do not repeatedly decompress the same stream. Once the budget is exhausted, new decoded streams are refused. This first version uses refusal rather than cache eviction because the engine may retain decoded structural data internally.
- Engine structural decoding is restricted to the same supported filters as user-facing decoding: Flate, ASCIIHex, and ASCII85, including their abbreviated names. Unsupported structural filters produce partial results/warnings.
- Source and stream display previews are capped at 256 KiB. This limit is separate from the decoder's output limit and original-file hex access. `StreamResult.truncated` records preview truncation.
- A 15-second worker-operation timeout terminates parsing/decoding. Closing or replacing a document disposes its worker and rejects outstanding requests.
- Parsed object graphs, serialized value trees, original bytes, preview renderings, worker message copies, and UI strings use additional memory beyond the decoded-data budget. It is not a total browser heap limit.

One `PdfWorkerClient` per open document is the intended lifecycle. Its worker owns its own engine module/cache. The direct `PdfInspector` class is used for isolated tests and should not be shared across concurrent documents.

## Known fidelity and scope limits

- Object enumeration, value-tree serialization, and reference indexing are **eager** once opening begins. They run in a worker, but the inspector does not yet stream indexing progress or lazily fetch each object. Very large object graphs can hit the time/object limits.
- Values are the engine's semantic interpretation. Duplicate dictionary keys are collapsed by the engine, lexical number spellings and name escapes are normalized, and raw PDF string bytes are not separately returned in the serialized value tree. Original source is retained separately wherever provenance is verified. These gaps must not be presented as byte-exact semantic roundtripping.
- Malformed zero/out-of-range in-use xref targets are omitted with an unavailable-object warning, rather than exposed as synthetic null source objects. Explicitly defined null objects are preserved. Objects without a verified terminator, or with a mismatching xref target, have **unknown** provenance and a warning. The source view for these uses reconstructed readable values. Recovered files are visibly marked at document level.
- Recovery is provided by the engine and may infer objects from damaged files. A recovered view is an interpretation, not a repaired PDF or a conformance verdict.
- Only the current effective object set is indexed. Older revisions remain in the immutable original bytes; historical object-version browsing is not implemented.
- Page resources can be inherited through `/Parent`; the raw dictionary tree does not synthesize inherited entries. The UI must label any derived inherited-resource convenience view as such.
- User-facing decoded text is a byte-preserving Latin-1-style inspection string, not rendered page text extraction or a promise that the stream uses a human text encoding.
- Any decoded-stream search that consumes `readStream()` results is limited to the **first 256 KiB per stream** and must report that incompleteness. Full bounded decoded searching needs a separate worker search operation before claiming complete decoded results.
- JPEG, JPEG2000, JBIG2, CCITT, LZW, and RunLength decoding are not enabled for inspection. Raw bytes remain available. Page preview may render images through a separate engine without changing this inspection capability list.
- Password entry is not implemented. All encrypted documents are locked for inspection in this version, including owner-password-only files. Raw file bytes remain accessible.
- Stream dictionaries and raw byte payloads are retained; arbitrary embedded document actions are not executed.
- An opt-in 15-file independent corpus now checks pages, object identities, sampled offsets, immutability, recovery, and encryption; see [CORPUS.md](CORPUS.md). Actual Safari testing, broader current-producer coverage, browser memory/performance measurements, and the observed usability session remain pending.

## Release readiness

The core parser feasibility questions have a positive prototype result for the tested formats: object enumeration, original boundaries, compressed provenance, updates/hybrid xrefs, and decoding work through an established TypeScript engine. The app can integrate this adapter for its first end-to-end exploration flow.

This is **not yet the complete first release described in PLAN.md**. Before a public release, verify browser behavior, label all incomplete searches/fidelity states in the UI, test representative external PDFs, measure the performance budgets, and decide whether this version-pinned internal adapter is acceptable to maintain or should be replaced with an upstream-supported low-level interface.

## Primary sources

- [LibPDF source and project status](https://github.com/LibPDF-js/core)
- [LibPDF document parser](https://github.com/LibPDF-js/core/blob/main/src/parser/document-parser.ts)
- [pdf-lib parser](https://github.com/Hopding/pdf-lib/blob/master/src/core/parser/PDFParser.ts)
- [PDF.js document API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html)
