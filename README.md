# PDF Internals Viewer

Explore PDF objects alongside their original bytes. Open a local file, follow references, and inspect raw or decoded streams. An optional EmbedPDF preview renders pages locally. The app is read-only and built with TypeScript, React, Vite, and shadcn/ui using Base UI.

**[Open the app](https://pdf-internals-viewer.pages.dev)**

## Run locally

Requires Node.js 22.18+ (or a compatible newer release) and pnpm 10.33.4 (pinned in `packageManager`). Install that version with `npm install --global pnpm@10.33.4` if needed.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

`pnpm-lock.yaml` is the sole dependency lockfile. CI uses a frozen install and caches the pnpm store. Project settings enable preparation hooks and copy installed packages so the preview backport cannot modify the shared store. See [dependency setup](docs/DEPENDENCIES.md).

Open the URL printed by Vite. The homepage opens directly to the workspace with a file picker and three original sample PDFs. The footer links to `/about`, project feedback, and the source on GitHub. Visiting About within the app preserves the current document in memory. You can also drop a PDF anywhere in the app. The app processes files in memory on your device. It does not upload or save them.

## Explore a PDF

1. Open a PDF or select **A simple page**.
2. Choose **First page**, then follow its `/Contents` reference.
3. Switch between **Properties**, **Source**, **Raw stream**, and **Decoded**.
4. Inspect the highlighted original file bytes on the right. Objects inside compressed object streams instead identify their container and decoded offset.
5. Use Back/Forward to retrace objects, inspector tabs, sections, and selected byte ranges; use **File structure** for the trailer/xref entry point, or **Preview** to render the selected page locally.

Search supports object IDs/labels, dictionary keys, Latin-1 file bytes, hex bytes, and opt-in decoded stream byte text. Search results are capped at 500. Decoded search reads bounded stream previews and reports when results are incomplete. It searches stream bytes, so it does not extract rendered page text.

Keyboard: Ctrl/Cmd+O opens a file; Ctrl/Cmd+K focuses search. The hex viewer supports arrow keys, Home/End, and Enter to inspect a byte's containing object. Enter offsets as decimal or with a `0x` hex prefix.

At narrower widths, use Explorer / Inspector / Original bytes tabs. Desktop panes can be resized with the separators, including via keyboard.

## Investigation tools

- Resource image previews load locally as their rows become visible, including supported embedded JPEGs; unavailable previews explain the reason. Downloadable fonts and attachments show their complete decoded size. Images show the size of the exported PNG/JPEG and the stored stream size separately. Size calculation and image export obey the same decoding limits as downloads; unsupported sizes are labelled unavailable. Canvas work is serialized and full-size export buffers are released after calculating sizes/previews.
- Download images directly from **Resources → Images** or the image object inspector. Supported 8-bit RGB/grayscale samples export at their full dimensions as PNG (up to 4 megapixels / 4096 pixels per side); standalone DCT/JPEG streams save as `.jpg` without re-encoding. Image payloads are limited to 32 MiB. Page transforms are not applied; JPEG extraction also omits PDF masks and color adjustments. Unsupported codecs, filter chains, or PNG masks/custom color spaces are explained in the UI rather than producing an incorrect file.
- Download embedded attachments from their file specifications or embedded streams, and embedded fonts from their font objects, descriptors, or font streams. Downloads save complete decoded bytes, using supported filters, up to 32 MiB per file. Font downloads may be subsets containing only the PDF's used characters; they do not restore the full original font, and some font programs are not directly installable.
- In **Resources**, use **Fonts**, **Attachments**, **Images**, or **Forms** to narrow the list. Category counts cover indexed resources; search includes attachment filenames and font names. Fonts and attachments offer downloads directly in the list. Filters persist when inspecting an object and returning, and reset when opening another PDF. Attachments are listed once per stream and filename, including identified embedded streams without file specifications; unavailable or unparsed objects may contain other files.
- Open **Pages** in the explorer to expand a page’s content streams, resources, and annotations. Select an object to inspect it alongside its original bytes. Inherited resources identify their actual source; shared, cyclic, and unavailable references are labelled. Expansion stays open across history, section changes, and mobile pane switches, and clears on document replacement. Large lists show 50 entries at a time; expansion stops after six levels, with full object inspection still available.
- Read the explanation beneath an object heading for its identified role. Known pages, content streams, fonts, images, forms, and page-tree objects have specific explanations; uncertain roles remain explicit. Resource availability does not establish that a resource is drawn.
- Follow **References** and **Referenced by** links labelled with their dictionary keys and array indexes. Incoming links open the actual referring object; outgoing links preserve the key route in the exploration trail. Relationship details are bounded and incomplete results are labelled.
- Follow the clickable exploration trail to revisit the objects and dictionary keys used along your route. Expand references inline to inspect a dictionary without leaving its surrounding object; cycles and unavailable references are labelled.
- Use **Pin to compare**, then select another object to compare typed dictionary values and highlight added, removed, or changed keys. Stream payloads are not compared. Drag the horizontal divider between comparison and inspection to resize either section, or focus it and use the arrow keys. Each section scrolls independently.
- In a content stream's **Decoded** tab, switch between **Readable instructions** and **Decoded byte text**. Instruction explanations and resource links use page/form resource context; ambiguous contexts require an explicit choice. These explanations do not extract text or establish rendered positions.
- Open **Resources** for font details, image/form objects, and links to pages exposing those resources. Image thumbnails are generated locally on request for supported bounded images; unsupported formats retain dictionary and byte inspection.
- **Bookmark** objects or explicit byte ranges and add notes in the explorer. Bookmarks and notes are saved in browser local storage using a SHA-256 hash of the PDF contents. Reopening the same PDF restores them, even under a different filename; different file contents have separate bookmarks. Clearing site data removes saved bookmarks. If browser storage is unavailable, bookmarks remain usable for the current open file and a status message explains that they are not saved. PDF files and passwords are not saved; bookmark notes from encrypted PDFs remain readable in browser storage. Pinned comparisons clear when the file is closed or replaced.

Open **User guide** in the header for a short explanation of the workspace sections, bookmarks, and pinning to compare.

## Verify

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm exec playwright install chromium
pnpm run test:e2e
```

Tests cover the preview validation backport and scoped tooling compatibility. Parser tests cover classic, stream, and hybrid xrefs; compressed objects; incremental updates and free entries; exact object boundaries and deceptive binary markers; required filters; encryption; recovery; references; and bounded decompression. Browser tests cover the integrated exploration flow and local rendering. CI runs these against production builds in Chromium, Firefox, and WebKit. WebKit automation is not a full test of the Safari application. See [browser evidence and reproduction](docs/BROWSERS.md).

`pnpm run build` produces the static site in `dist/`. `pnpm run preview` serves the built site locally. Cloudflare Pages is configured in `wrangler.jsonc`; the public app is available at the link above. Once the repository's Cloudflare Actions secrets are configured, pushes/merges to `main` deploy automatically after all CI checks pass. Other branches and pull requests only run checks. See [Cloudflare setup and release steps](docs/HOSTING.md).

## Independent PDF corpus

```sh
pnpm run corpus:fetch
pnpm run test:corpus
```

This opt-in suite checks 15 upstream PDFs against observations from independent readers. Each PDF is pinned to a commit and hash. Downloads stay in ignored `.context/corpus/`; third-party documents are not bundled or redistributed. Coverage includes Word, Quartz, Adobe, TeX, a scan, forms, incremental updates, damaged cross-references, encryption, and a document containing over 85,000 objects. See [the corpus report](docs/CORPUS.md) for evidence and known partial results.

## Public-facing limitations

**About & limitations** is always available in the footer, including on mobile. The opening screen also links to it before a file is loaded. The scrollable dialog describes supported files/filters, encrypted-file behavior, source fidelity, preview/search truncation, browser coverage, resource limits, and local processing. It never opens automatically or requires acknowledgment.

## Parser and preview

The inspection adapter uses @libpdf/core 0.5.3, a pinned TypeScript engine. Its low-level parsers are not public exports, so a deterministic build script exposes them in a generated, gitignored module. The script checks the exact source hash and preserves the upstream MIT license. It does not mutate `node_modules` or rewrite the user's PDF. `pnpm install --frozen-lockfile` generates the adapter automatically; upgrades require explicit compatibility work. See [parser capability notes](docs/PARSER.md).

Preview loads on demand through EmbedPDF 3.1.0. Its PDFium engine runs as WebAssembly in a worker. Worker/WASM assets are served by the application build, with no CDN or cloud engine. See [preview notes](docs/PREVIEW.md). Installation and build hooks also apply a version- and hash-checked validation backport to the pinned preview dependency and its bundled worker copies; see [the backport notes](docs/PREVIEW-VALIDATION.md).

## Limits and current gaps

Some features in [the plan](docs/PLAN.md) remain unimplemented.

- 64 MiB input limit, 100,000 indirect-object limit, 15-second worker-operation timeout.
- 32 MiB decoded stream limit and 128 MiB total decoded allocation budget; displayed source/stream previews are capped at 256 KiB.
- Object indexing is currently eager within the worker, not incremental/lazy. Very large graphs can still consume substantial memory beyond the decoded-data budget.
- Encrypted PDFs with an empty opening password unlock automatically. Otherwise enter an opening or owner password for local structure inspection and preview. Original source and raw stream bytes stay encrypted; properties and decoded streams are decrypted. Unsupported encryption remains unavailable. Passwords stay in memory only until the document is closed or replaced.
- Decoded inspection supports Flate (including tested PNG predictors), ASCIIHex, ASCII85, and chains of those filters. Unsupported filters keep raw inspection available.
- Recovered structure and unknown positions are labeled. Decoded positions are never presented as original file offsets. Dictionary order/duplicates and exact string spellings are not guaranteed by the semantic inspector; original bytes remain authoritative.
- Historical object revisions, precise rendered-content-to-byte mapping, extracted text search, editing, repair, saving PDF files, and comparing stream payloads are deferred.
- Tooling advisories have been removed from this lockfile. One high-severity advisory remains tied to EmbedPDF's upstream Zod version, despite the tested local backport. The audit report is not suppressed. See [dependency remediation and remaining obligations](docs/DEPENDENCIES.md) before release.
- Automated browser checks target Chromium, Firefox, and WebKit; actual Safari and broader PDF/browser coverage still need validation. Node corpus measurements are not the planned browser performance baseline.

## Sample provenance and licensing

The bundled PDFs are generated from original fixture definitions in `scripts/fixtures/pdf-fixtures.mjs`; no third-party documents are included. Regenerate them with `node scripts/fixtures/generate.mjs`. Their text uses standard PDF fonts. Dependency licenses remain with their respective authors; the generated adapter preserves the upstream license. The project source is [MIT licensed](LICENSE). Third-party dependencies and assets retain their own licenses.

## UI tooling

The generated shadcn/ui + Base UI components are checked in. Their supporting CSS is vendored from shadcn 4.23.0 with its MIT notice, so the component-generation CLI is not part of the installed build toolchain. See `public/licenses/shadcn.txt`.

## Release work

See [the shared work list](docs/WORKLIST.md) for owners, dependencies, release requirements, and pending decisions.

See [the security policy](SECURITY.md) for private vulnerability reports, the known dependency advisory, and credential handling.
