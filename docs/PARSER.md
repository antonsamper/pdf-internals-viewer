# Inspection parser

The inspector reads PDFs with @libpdf/core 0.5.3, a TypeScript library. It is separate from EmbedPDF's PDFium engine, which only renders the page preview. LibPDF was chosen because it resolves the current object set from the cross-reference data, including object streams, hybrid files and incremental updates, and gives access to exact byte positions. It is beta software, and the low-level classes the viewer needs are not public exports; see [Instrumentation](#instrumentation-and-reproducibility).

Full PDF compatibility is not claimed. `tests/parser.test.ts` covers the supported structures, and an opt-in [corpus](CORPUS.md) checks the engine against independent files.

## Source provenance

Every object record carries a `provenance` value (`src/lib/pdf/types.ts`) saying where its bytes came from:

- `file`: an exact byte range `[start, end)` in the original input. The Source tab shows the original syntax.
- `decoded`: an object inside an object stream, located within the container's decoded bytes. The inspector links to the container and labels the source as decoded syntax.
- `unknown`: no exact location could be verified. The Source tab shows text rebuilt from the parsed values and says so.

The viewer never claims original bytes it cannot prove. Compressed objects link to their container's original bytes but never map one-to-one through compression, and derived views such as inherited page resources name the object they come from.

## Worker delivery

A dedicated worker parses the document and indexes every object, reference, resource, download and action up front. It sends the result to the page in acknowledged batches (`src/lib/pdf/document-transfer.ts`) so no single message has to carry the whole graph. The page only shows the document once every batch has arrived. Closing or replacing a document terminates its worker. A locked document has an empty action list. Unlocking opens it again in a new worker, which builds the list.

## Instrumentation and reproducibility

`scripts/prepare-parser.mjs` exposes LibPDF's internal document parser, scanner and xref parser in a generated module, `src/generated/libpdf-inspection.mjs`. It is not committed; `prepare:deps` regenerates it before development, tests and builds. The script:

- requires LibPDF 0.5.3 exactly and checks the SHA-256 of its bundle;
- never modifies `node_modules` or the input PDF;
- finds object boundaries from the engine's parsed tokens, not by searching for `obj`/`endobj` text;
- bounds Flate decoding and stubs out two optional cloud-signing imports the read-only adapter never uses.

Import the adapter as `pdf-internals-viewer/inspection`, which resolves in the browser build, the development server and the Node tests. The adapter relies on internal fields with no stable API, so upgrading LibPDF makes preparation fail until the adapter has been reviewed and the provenance tests pass again.

## Processing limits

`src/lib/pdf/limits.ts` sets the main limits: 64 MiB per file, 100,000 objects, 32 MiB of decoded data per stream, 256 KiB previews and a 15-second timeout per operation. Each document also has a 128 MiB budget for all decoded data. These bound decoded data and work, not total browser memory.

## Known limits

- Opening indexes every object up front, with no progress reporting or lazy loading, so very large files can hit the time or object limits.
- Values are the engine's interpretation: duplicate keys collapse and number and name spellings are normalised. The original bytes are kept separately wherever provenance is verified.
- Only the latest version of each object is indexed. Older revisions stay in the bytes but cannot be browsed.
- Recovery of damaged files is an interpretation, not a repair, and recovered documents are marked as such.
- Only Flate, ASCIIHex and ASCII85 decode for inspection. JPEG, JPEG2000, JBIG2, CCITT, LZW and RunLength streams show raw bytes, though the preview can still render them.
- Encrypted files unlock automatically with an empty password, or with an opening or owner password, which is never stored. Source and raw views keep the encrypted bytes; properties and decoded streams use decrypted data.

## Page text source mapping

Page text search uses the EmbedPDF engine to find words on each page (`src/lib/pdf/page-text-search.ts`). Each search starts its own engine and waits up to 2 minutes for it to download and load. After that, each engine step (opening the file, listing pages, each batch of 25 pages) has 15 seconds. A separate mapper (`src/lib/pdf/page-text.ts`) then tries to trace each match back to the content-stream bytes that draw it. The renderer understands more encodings than the mapper, so a page can match without a mapped source; the UI labels that stream as a candidate and highlights no word bytes.

The mapper supports:

- direct page `/Contents` streams, including indirect arrays and inherited font resources, but not Form XObjects;
- character codes 32 to 126 in the standard Helvetica, Times and Courier fonts, and simple fonts using WinAnsi, MacRoman or Standard encoding without `/Differences`;
- fixed-width `/ToUnicode` CMaps with `bfchar` and `bfrange` mappings, including multibyte codes and ligatures;
- literal and hexadecimal strings, escapes, and strings split across `TJ` arrays, with large negative `TJ` adjustments treated as possible word spaces.

Unfiltered, unencrypted streams highlight the exact bytes in the original file. Compressed or encrypted streams highlight decoded bytes and only the containing stream in the original file; no original offsets are invented. Search stops at 500 matches, and mapping at 100 source locations per page. A page that reaches that limit says its source list is incomplete; matches and streams after the limit are not listed. There is no OCR.
