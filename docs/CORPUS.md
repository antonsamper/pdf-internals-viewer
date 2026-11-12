# PDF corpus verification

## Repeat the checks

```sh
pnpm run corpus:fetch
pnpm run test:corpus
```

Fetch the corpus explicitly when you want to run it. The manifest pins each remote PDF to a repository commit, SHA-256, and exact size. The runner checks cached bytes before parsing and never downloads implicitly. Files live only under ignored `.context/corpus/`; none are bundled, committed, or redistributed. The upstream repository license does not establish rights to the documents themselves.

Each PDF is parsed in a separate Node process with a 384 MiB JavaScript heap ceiling and a 15-second timeout. Tests compare pages, object identities/counts, compressed-object counts, and sampled source offsets to independently recorded pypdf 6.14.2 and Poppler `pdfinfo` 26.07.0 observations. Every verified original range must lie within the unchanged input bytes. A file must match these expectations to pass; opening without a crash is insufficient.

## Recorded results

Recorded 2026-11-11T13:20:26.623Z using Node v22.23.2 on darwin/arm64. All 15 corpus tests passed. Timings and heap figures below are Node observations, not browser benchmarks or peak-memory measurements.

| Upstream fixture | Pages | Objects | Cross-references | Parse ms | Heap MiB |
| --- | ---: | ---: | --- | ---: | ---: |
| pdfjs-helloworld | 1 | 5 | table | 2.98 | 18.32 |
| pdfjs-openoffice | 1 | 10 | table | 4.46 | 19.43 |
| pdfjs-bug1937438_from_word | 1 | 43 | hybrid | 12.20 | 18.22 |
| pdfjs-chrome-text-selection-markedContent | 1 | 515 | stream | 30.89 | 23.53 |
| pdfjs-scan-bad | 1 | 11 | unknown | 8.14 | 17.74 |
| pdfjs-images_1bit_grayscale | 1 | 12 | table | 4.40 | 18.92 |
| pdfjs-tracemonkey | 14 | 996 | table | 62.52 | 27.17 |
| pdfjs-cmykjpeg | 1 | 35 | table | 15.93 | 23.01 |
| pdf-lib-normal | 2 | 108 | table | 13.92 | 18.67 |
| pdf-lib-with_update_sections | 1 | 135 | table | 16.98 | 19.36 |
| pdf-lib-linearized_with_object_streams | 206 | 85,334 | stream | 1513.94 | 240.11 |
| pdf-lib-missing_endobj_keyword | 1 | 7 | table | 3.69 | 18.40 |
| pdf-lib-invalid_root_ref | 0 | 6 | hybrid | 8.86 | 18.91 |
| pdf-lib-encrypted_new | Locked | 0 | stream | 7.67 | 19.53 |
| pdf-lib-create_form | 1 | 88 | stream | 13.84 | 18.71 |

## Findings and fixes

- Quartz/Apple document: five malformed in-use cross-reference entries pointed to byte zero. The engine returned synthetic null placeholders for them. The adapter now marks invalid zero/out-of-range targets unavailable, omits them from the indexed object set, and emits document warnings. The 108 real objects match the independent reader. Explicitly defined `null` objects remain supported, verified by separate regression tests.
- Missing object terminator: object `10 0` in the missing-endobj fixture has no trustworthy end boundary. Its provenance remains unknown because no original-byte range can be verified. The corpus explicitly expects this exception while checking the other sampled offsets.
- Damaged root fixture: the engine exposes a partial object set and warnings, but does not recover all pages/objects found by the independent reader. This is a known recovery limitation, so the passing test does not establish full compatibility. Its test requires preserved structure and visible diagnostics, allowing future improved recovery.
- Large Illustrator document: a 4,019,135-byte linearized PDF contains 206 pages and 85,334 objects, including 83,804 compressed objects. Its object count shows how a small file can require substantial parsing work. The current file/object guardrails remain unchanged; the corpus is not enough evidence to tune them.

## Coverage and remaining gaps

Metadata confirms examples produced by Microsoft Word 365, Quartz PDFContext, Adobe Illustrator/PDF library, pdf-lib, TeX, and a Canon scan. Other fixtures exercise JPEG/CMYK images, one-bit grayscale images, forms, cross-reference streams, hybrid files, incremental updates, linearization, compressed objects, encryption, missing terminators, and malformed cross-references. See each manifest entry for exact producer evidence and source URLs.

An upstream fixture named `chrome-text-selection-markedContent` reports iLovePDF as its producer; it is not evidence of an untouched Chrome-generated PDF. Likewise the OpenOffice-named fixture lacks producer metadata. Further coverage should include untouched current Chrome/Edge output, modern Office exports, and more scanner and design-tool samples. Browser memory and interaction measurements and observed usability sessions also remain to be added. WebKit automation is distinct from testing the Safari application.

The independent oracle observations are checked-in expectations. `corpus:fetch` does not install Python or run native readers; reviewing/changing expectations requires a separate independent-reader check. Results are written to `.context/corpus-results.json` for review, outside source control.
