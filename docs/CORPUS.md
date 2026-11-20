# PDF corpus verification

The corpus checks the inspection engine against 15 real-world PDFs from the pdf.js and pdf-lib repositories. Expected results come from independent readers, not from this project's parser.

## Running the checks

```sh
pnpm run corpus:fetch
pnpm run test:corpus
```

`scripts/corpus/manifest.json` pins each PDF to an upstream repository commit, a SHA-256 and an exact size. `corpus:fetch` downloads the files into the gitignored `.context/corpus/` directory and rejects any file whose size or hash differs. `test:corpus` never downloads: it fails if a file is missing and checks each cached file's size and hash before parsing it. No corpus PDF is bundled, committed or published. The upstream repositories' licences do not establish rights to the documents themselves.

Each PDF is parsed in a separate Node process with a 384 MiB JavaScript heap limit and a 15-second timeout. The tests compare page counts, object identities and counts, compressed-object counts and sampled source offsets with observations recorded from pypdf 6.14.2 and Poppler `pdfinfo` 26.07.0. Every verified source range must lie within the unchanged input bytes. Opening a file without crashing is not enough to pass.

Each run writes per-file results, including Node parse time and heap use, to `.context/corpus-results.json`, a gitignored local file. Those Node figures are not browser measurements; see [PERFORMANCE.md](PERFORMANCE.md) for those.

## Corpus files

Pages and objects are what the inspection engine reports. Cross-references give the format it detects.

| Upstream fixture | Pages | Objects | Cross-references |
| --- | ---: | ---: | --- |
| pdfjs-helloworld | 1 | 5 | table |
| pdfjs-openoffice | 1 | 10 | table |
| pdfjs-bug1937438_from_word | 1 | 43 | hybrid |
| pdfjs-chrome-text-selection-markedContent | 1 | 515 | stream |
| pdfjs-scan-bad | 1 | 11 | unknown |
| pdfjs-images_1bit_grayscale | 1 | 12 | table |
| pdfjs-tracemonkey | 14 | 996 | table |
| pdfjs-cmykjpeg | 1 | 35 | table |
| pdf-lib-normal | 2 | 108 | table |
| pdf-lib-with_update_sections | 1 | 135 | table |
| pdf-lib-linearized_with_object_streams | 206 | 85,334 | stream |
| pdf-lib-missing_endobj_keyword | 1 | 7 | table |
| pdf-lib-invalid_root_ref | 0 | 6 | hybrid |
| pdf-lib-encrypted_new | Locked | 0 | stream |
| pdf-lib-create_form | 1 | 88 | stream |

## Known behaviours

- `pdf-lib-normal` (Quartz PDFContext): five in-use cross-reference entries point to byte zero. The adapter marks zero and out-of-range targets unavailable, leaves them out of the indexed objects and adds a document warning. The remaining 108 objects match the independent reader. Objects explicitly defined as `null` are still supported, and separate regression tests cover them.
- `pdf-lib-missing_endobj_keyword`: object `10 0` has no trustworthy end boundary, so no original byte range can be verified and its source location is reported as unknown. The test expects that and still checks the other sampled offsets.
- `pdf-lib-invalid_root_ref`: the engine recovers part of the structure with warnings, but finds fewer pages and objects than the independent reader (1 page, 27 objects). This is a known recovery limit. The test requires the parser to keep at least some objects and either match the page count or report warnings, so better recovery still passes.
- `pdfjs-scan-bad`: the engine recovers the document and reports warnings.
- `pdf-lib-encrypted_new`: the document opens as locked, with no objects exposed.
- `pdf-lib-linearized_with_object_streams`: a 4,019,135-byte Adobe Illustrator file with 206 pages and 85,334 objects, 83,804 of them in object streams. Its size understates its parsing cost.

## Coverage and gaps

Producer metadata includes Microsoft Word for Microsoft 365, Quartz PDFContext, Adobe Illustrator and the Adobe PDF library, pdf-lib, TeX and a Canon scanner. Other fixtures cover JPEG and CMYK images, one-bit greyscale images, forms, cross-reference streams, hybrid files, incremental updates, linearisation, object streams, encryption, a missing object terminator and malformed cross-references. Each manifest entry records its producer and source URL.

Two fixture names are misleading. `pdfjs-chrome-text-selection-markedContent` reports iLovePDF as its producer, so it is not an untouched Chrome PDF, and the OpenOffice-named fixture has no producer metadata. The corpus has no untouched current Chrome or Edge output, no modern Office exports, and few scanner and design-tool files.

The expected values are checked into the manifest. `corpus:fetch` does not install Python or run the independent readers, so changing an expectation requires a separate check with those readers.
