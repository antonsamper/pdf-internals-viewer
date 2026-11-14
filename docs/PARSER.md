# Parser feasibility result

Status: the prototype adapter works in the browser for the tested PDF formats. Full PDF compatibility has not been established.

## Selected engine

The inspection engine is @libpdf/core 0.5.3, a TypeScript library. It is separate from EmbedPDF's PDFium preview engine. The application and inspection adapter both stay in TypeScript, with no native parser service.

Evaluated alternatives:

- pdf-lib 1.17.1: exposes useful low-level parser classes, but its physical-object scan ignores freed cross-reference entries and is insufficient on its own for this viewer's current-object/provenance contract.
- PDF.js public API: useful for rendering, but does not establish arbitrary indirect object enumeration and exact source spans.
- LibPDF: has a cross-reference-driven parser, hybrid and `/Prev` resolution, lazy objects, object streams, and stream byte views. These capabilities more closely match the inspection requirements.
- QPDF/WebAssembly: remains a future alternative if the TypeScript engine reaches a material fidelity limit. It has not been introduced.

LibPDF is beta software. The low-level classes needed here exist in its distributed bundle but are outside its public exports. The prototype exposes them through build instrumentation pinned to this version.

## Instrumentation and reproducibility

`scripts/prepare-parser.mjs` reads the installed bundle and produces `src/generated/libpdf-inspection.mjs` and a small declaration file. Generated artifacts are excluded from version control and regenerated before development, tests, and builds.

The preparation script:

1. Requires exact version `0.5.3` and checks the unmodified bundle's SHA-256: `7b9b699034c81be2ab6af3337e0d2559df2b91b5016913b2c202cbaafc534400`.
2. Verifies expected low-level symbols and copies the bundle's runtime helper and license.
3. Exposes the engine's existing document parser, scanner, xref parser, and a few provenance helper functions. It does not rewrite PDF input or change cross-reference resolution.
4. Captures original object boundaries using the engine's parsed token locations and stream parser, not a regex scan for `obj`/`endobj` text.
5. Uses object-stream index entries and parsed tokens to locate decoded source. A compressed object links to its containing original stream; it has no direct file range.
6. Bounds Flate decoding and decoded stream storage as described below.
7. Resolves all static external imports through the engine package's own dependency chain before relocating the bundle, supporting pnpm's isolated dependency layout. Its `lru-cache` import specifically uses the browser ESM entry to avoid Node-only diagnostics.
8. Replaces two unused optional Google Cloud signing imports with explicit unsupported-operation rejections. These signing operations are outside the read-only adapter. Vite development import analysis otherwise attempts to resolve the optional SDKs even though production tree-shaking removes them. No cloud SDK is installed or used.

The inspector imports the generated adapter through the package's `pdf-internals-viewer/inspection` self-reference. Vite explicitly prebundles this entry and its dependency graph for development workers. Direct relative imports bypassed that conversion and caused native workers to reject named CommonJS exports (for example, `asn1js`'s `Boolean`), while production bundling continued to work. The self-reference also resolves in Node parser/corpus tests. CI exercises sample opening, replacement, references, compressed objects, and stream decoding against both production assets and the development server.

The script leaves `node_modules` unchanged. An engine upgrade fails preparation until the instrumentation and fixture results have been reviewed. The generated module retains the upstream license; the engine dependency and lockfile remain the source of truth. A future upstream low-level export would remove much of this instrumentation.

The generated adapter depends on internal token lookahead fields. They have no stable public API contract. Its provenance tests are mandatory when the engine changes.

## Verified capabilities

The fixtures verify the following behaviors. Other PDFs may exercise cases they do not cover.

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
| Encryption state | Independent pypdf fixtures verify RC4-40/128, AES-128/256, empty/user/owner passwords, retries, decrypted strings/streams, and original-byte preservation |
| Invalid xref recovery | Truncated xref recovers objects with an explicit recovered warning |
| Input immutability | Original bytes unchanged after parsing/decoding |
| Decompression bound | 33 MiB decoded Flate fixture is refused while raw stream access remains available |

`tests/parser.test.ts` currently covers these behaviors. Test count can change as cases are added.

The three bundled sample PDFs are generated by `scripts/fixtures/generate.mjs`, from original project-owned content with no external fonts or images. Their page count, page content, and compressed-object count were independently checked with pypdf 6.14.2. Poppler's `pdftotext` also extracts the compressed sample's expected text. Fixture expected offsets are recorded when constructing the bytes, not calculated by the inspection engine under test.

## Memory and execution limits

- 64 MiB input limit and 100,000 non-free cross-reference entries.
- 32 MiB decoded limit per stream. Flate uses a streaming inflater with 64 KiB output chunks, aborting when the limit is crossed, before assembling the complete oversized result.
- 128 MiB cumulative decoded-data budget per worker/document. The engine's stream decoder is wrapped in a shared weak cache so repeated requests and object-stream provenance do not repeatedly decompress the same stream. Once the budget is exhausted, this first version refuses new decoded streams. Evicting the cache would not reliably reclaim structural data the engine may retain internally.
- Engine structural decoding is restricted to the same supported filters as user-facing decoding: Flate, ASCIIHex, and ASCII85, including their abbreviated names. Unsupported structural filters produce partial results/warnings.
- Source and stream display previews are capped at 256 KiB. This limit is separate from the decoder's output limit and original-file hex access. `StreamResult.truncated` records preview truncation.
- Asset downloads use the full bounded stream rather than the display preview. Size requests return the complete decoded byte count without copying the payload to the UI. Both retain the 32 MiB stream and 128 MiB cumulative decoding limits; incomplete or unsupported data is not downloaded.
- Image export converts supported 8-bit DeviceRGB/DeviceGray samples to PNG, limited to 4 megapixels and 4096 pixels per side. A single DCTDecode/DCT image stream can instead export its embedded JPEG bytes without re-encoding, with the encoded representation explicitly marked in the result. This does not enable JPEG decoding in the inspector. Resource previews and export-size calculation start as rows become visible; canvas work is serialized and export buffers are released afterward.
- A 15-second worker-operation timeout terminates parsing/decoding. Closing or replacing a document disposes its worker and rejects outstanding requests.
- Parsed object graphs, serialized value trees, original bytes, preview renderings, worker message copies, and UI strings use additional memory beyond the decoded-data budget. It is not a total browser heap limit.

One `PdfWorkerClient` per open document is the intended lifecycle. Its worker owns its own engine module/cache. The direct `PdfInspector` class is used for isolated tests and should not be shared across concurrent documents.

## Known fidelity and scope limits

- Opening eagerly enumerates objects, serializes value trees, and indexes references. These operations run in a worker, but the inspector does not yet stream indexing progress or lazily fetch each object. Very large object graphs can hit the time/object limits.
- Values are the engine's semantic interpretation. Duplicate dictionary keys are collapsed by the engine, lexical number spellings and name escapes are normalized, and raw PDF string bytes are not separately returned in the serialized value tree. Original source is retained separately wherever provenance is verified. These gaps must not be presented as byte-exact semantic roundtripping.
- The adapter omits malformed zero/out-of-range in-use xref targets and reports an unavailable-object warning. It does not create synthetic null source objects for them. Explicitly defined null objects are preserved. Objects without a verified terminator, or with a mismatching xref target, have unknown provenance and a warning. The source view for these uses reconstructed readable values. Recovered files are visibly marked at document level.
- Recovery is provided by the engine and may infer objects from damaged files. A recovered view interprets damaged input. It neither repairs the PDF nor establishes conformance.
- Only the current effective object set is indexed. Older revisions remain in the immutable original bytes; historical object-version browsing is not implemented.
- Page resources can be inherited through `/Parent`; the raw dictionary tree does not synthesize inherited entries. The UI must label any derived inherited-resource convenience view as such.
- Decoded text uses a byte-preserving Latin-1-style inspection string. It does not extract rendered page text, and the stream may not use a human text encoding.
- Any decoded-stream search that consumes `readStream()` results is limited to the first 256 KiB per stream and must report that incompleteness. Full bounded decoded searching needs a separate worker search operation before claiming complete decoded results.
- JPEG, JPEG2000, JBIG2, CCITT, LZW, and RunLength decoding are not enabled for inspection. Raw bytes remain available. Page preview may render images through a separate engine without changing this inspection capability list.
- Embedded attachments are discovered from file-specification `/EF` entries and indexed `/EmbeddedFile` streams; unavailable/unparsed objects can contain additional files. Font files resolve through descriptors and composite-font descendants. Font downloads may be subsets rather than complete original fonts. PNG export rejects masks, custom decoding, unsupported color spaces and codecs; extracted JPEGs do not apply PDF masks, color adjustments, or page transforms.
- Empty-password encrypted files unlock automatically. Other standard encrypted files accept an opening or owner password through the worker. Passwords are not persisted. Unsupported security handlers remain unavailable. Source and raw stream views retain the original encrypted bytes; properties and decoded streams use decrypted data. The encryption dictionary itself is never decrypted.
- The pinned adapter normalizes both R6 permission values to signed int32 when verifying /Perms, accepting producers that write an unsigned /P. It also turns the engine's silent ciphertext fallback on decryption failure into an object warning/unavailable result. Hash and replacement-shape guards cover both patches.
- Encryption fixtures under `tests/fixtures/encryption/` are original project content encrypted independently with pypdf 6.14.2. Regenerate with `python3 scripts/fixtures/generate-encrypted.py` (requires pypdf[crypto]); Python is not an app dependency.
- Stream dictionaries and raw byte payloads are retained; arbitrary embedded document actions are not executed.
- An opt-in 15-file independent corpus now checks pages, object identities, sampled offsets, immutability, recovery, and encryption; see [CORPUS.md](CORPUS.md). Actual Safari testing, broader current-producer coverage, browser memory/performance measurements, and the observed usability session remain pending.

## Release readiness

For the tested formats, the prototype can enumerate objects, locate original boundaries, track compressed-object provenance, resolve updates and hybrid xrefs, and decode streams through an established TypeScript engine. The app can integrate this adapter for its first end-to-end exploration flow.

The first release described in PLAN.md still has unfinished work. Before public release, verify browser behavior and test representative external PDFs. The UI must label incomplete searches and fidelity gaps, and browser measurements must establish performance against the planned budgets. Decide whether to maintain this adapter against pinned internals or replace it with an upstream-supported low-level interface.

## Primary sources

- [LibPDF source and project status](https://github.com/LibPDF-js/core)
- [LibPDF document parser](https://github.com/LibPDF-js/core/blob/main/src/parser/document-parser.ts)
- [pdf-lib parser](https://github.com/Hopding/pdf-lib/blob/master/src/core/parser/PDFParser.ts)
- [PDF.js document API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html)
