# PDF Internals Viewer

Status: Implementation underway. Browser/local processing and stack confirmed. The working prototype and remaining release gaps are documented in README.md and docs/PARSER.md.
Generated: 2026-11-11, using the office-hours planning workflow.
Branch: casablanca/pdf-internals-viewer-plan
Mode: Builder / developer tool and open-source project.

## Problem and audience

Developers exploring unfamiliar PDFs need to discover the document's objects, understand their relationships, and connect those objects to their physical representation. Switching between a hex editor, a renderer, and command-line dumps loses context.

The product is a read-only, browser-based PDF exploration workspace. Developers should be able to follow the structure without losing their place and distinguish original bytes from decoded representations.

User-confirmed direction:

- A developer tool or open-source project.
- Primarily for understanding unfamiliar PDFs.
- Browser application with files processed locally.
- Prefer TypeScript, React, and Node.js tooling. Explain any proposed use of another language before adopting it; the user allows an alternative when it is a better technical fit.
- Use shadcn/ui components with Base UI primitives, initialized as a plain Vite SPA. Theme selection is low priority for now.
- Prefer EmbedPDF for page preview. PDF.js is acceptable as a temporary starting point if materially easier, but avoid a planned migration when EmbedPDF can meet the initial preview needs directly.

## Core exploration journey

1. Open a local PDF, or choose a bundled sample.
2. See a document overview and discover pages, fonts, images, attachments, metadata, and structural warnings.
3. Select a page and inspect its dictionary.
4. Follow `/Contents` to a stream and switch from raw bytes to decoded drawing instructions.
5. Follow `/Resources` into fonts or images, including resources inherited through the page tree.
6. Jump to source bytes, inspect the enclosing object, and return through navigation history.

Success is a developer explaining how one page is assembled and locating the source of one object without leaving the app.

## Premises and boundaries

- Discovery and navigation lead the UI; hex remains directly accessible.
- Original input bytes are immutable and authoritative for file offsets.
- A PDF's relationships form a graph. The explorer provides paths into that graph. Lazy expansion and cycle markers keep it from recursively duplicating objects.
- Semantic values, original source syntax, decoded data, and rendered output are distinct representations.
- Parse failures and unsupported features must be visible. Partial exploration remains useful.
- No upload, account, document telemetry, PDF editing, repair output, or remote document analysis in the first release.
- Distribution is a public static website and source repository; no backend is required for normal use.

## Approaches considered

| Approach | Effort | Risk | Benefits | Costs |
| --- | --- | --- | --- | --- |
| Browser app with local parser worker | Medium to large | Medium to high until parser spike | Easy to share, private document handling, no installation | Must prove source mapping and browser engine packaging |
| Desktop app with native parser | Large | Medium | Native engine integration and filesystem access | Installation, packaging, updates, platform support |
| Local web app with native backend | Medium | Medium | Fast access to native tooling during development | Requires local setup and service lifecycle |

The browser approach is selected. Start with one PDF, an object explorer, an inspector, and a synchronized hex view. A parser adapter will provide provenance information so the UI can work independently of the chosen engine. There is no existing application code to reuse in this repository.

## Workspace and interaction design

Desktop-first, three resizable panes:

```text
Open / sample   filename   Search                 Back / Forward
----------------------------------------------------------------
Explorer          | Object inspector          | Original file bytes
                  |                          |
Overview          | 12 0 obj · Page           | Offset  Hex     ASCII
Document          | /Contents -> 24 0 R       | ... selected range ...
Pages             | /Resources -> 8 0 R       |
Resources         |                          |
All objects       | Properties / Source      | Jump to offset
File structure    | Raw / Decoded (streams)   |
----------------------------------------------------------------
Parse / indexing status · selected object's location · warnings
```

- Overview is the first selection and provides routes into the document without dumping all its data.
- Document starts at the catalog. Pages and resources are convenience indexes over real objects.
- All objects is a virtualized flat index with object ID, type, location, and role when known.
- File structure exposes header, cross-reference information, trailer, and `startxref` when reliably located.
- Inspector property values preserve PDF types; references are links. Preserve unknown keys.
- Source shows original syntax only when an exact source range exists. Otherwise label the representation as reconstructed or decoded.
- Every indirect object exposes outgoing references and incoming references. Incoming results are marked incomplete until indexing finishes.
- Show key explanations on demand, including `/Contents`, `/Resources`, `/Parent`, `/Kids`, `/Filter`, and `/Length`. Explanations never imply that a key is present when absent.
- Selecting an uncompressed object highlights its verified source range. Clicking a byte selects its containing object when known; unknown regions remain selectable without invented ownership.
- History stores object, representation, selection, and scroll position. Back and forward remain within the open document.
- Keyboard navigation, visible focus, selectable text, accessible pane labels, and warnings conveyed with text are first-release requirements.
- At narrow widths, use explorer / inspector / bytes tabs with shared selection.

### Source mapping contract

Every navigable value has a provenance category:

1. Original file range: zero-based, half-open byte range `[start, end)` in immutable input.
2. Decoded stream range: container object ID plus a range within decoded bytes.
3. Derived value: calculated or reconstructed, without a claimed exact source range.
4. Unknown: parsing or recovery did not establish a reliable location.

Objects in object streams link to their container's original bytes and their own decoded location. Never claim a one-to-one mapping through compression. The bytes pane remains explicitly labeled Original file; decoded hex belongs in the inspector. The initial mapping requirement covers object boundaries. Mapping every pretty-printed token is outside that scope.

## First release scope

### Opening and overview

- Drag-and-drop and file picker; replace the current file and cancel outstanding work cleanly.
- Overview: filename, size, header version, catalog version override if present, page count, object count, encryption state, discovered resource counts, and warnings. Unknown and still-indexing values are explicit.
- Three bundled, redistributable samples: a minimal page, a resource-rich document, and a document containing compressed objects.

### Structure and objects

- Numbers, booleans, null, names, literal/hex strings, arrays, dictionaries, indirect references, and stream dictionaries.
- The release must support classic cross-reference tables, cross-reference streams, hybrid references, and object streams. Unsupported cases must be explicit.
- Resolve the current effective object set across incremental updates, preserving original bytes. Historical object-version browsing and revision comparison are deferred.
- Detect dangling references and cycles; display them without freezing navigation.
- Page resources indicate whether they are local or inherited. Resource lists preserve links to defining objects.
- Index metadata and attachment descriptions; do not execute or automatically open attachments or document actions.

### Hex, streams, and search

- Virtualized hex/ASCII rows; copy selected bytes; display offsets in hex with decimal available; jump to offset.
- Stream tabs distinguish stored bytes, filter chain, and decoded bytes. Show decoded text with encoding caveats; arbitrary stream bytes are not assumed to be UTF-8.
- At minimum, prove Flate decoding, including predictors where applicable, plus chained ASCIIHex/ASCII85 decoding through the selected engine. Publish the tested filter support list. Unsupported codecs keep raw inspection available.
- Search scopes are explicit: object IDs, dictionary keys, original byte text/hex, and decoded stream text.
- Decoded search is opt-in, cancellable, bounded, and reports skipped/unsupported streams and incomplete results. Byte text search uses a stated byte encoding and is separate from rendered document text extraction.

### Partial states and limits

- Encrypted files expose original bytes while locked. Files with an empty opening password now unlock automatically; others accept an opening or owner password for local semantic inspection and preview. Unsupported encryption remains explicit rather than appearing as an empty document.
- Malformed files show parser diagnostics and any trustworthy partial results. Parser-recovered values are labeled; never present rewritten output as the input file.
- Starting guardrails: 64 MiB input limit, 32 MiB decoded output per stream, and 128 MiB total decoded cache. These are proposed limits to validate in the spike, displayed before a limit blocks work.
- Run parsing and decoding outside the UI thread. Support cancellation and terminate/restart the worker after a nonresponsive operation. Keep raw-byte inspection available after parser failure where memory permits.
- Render all document-provided text as data. Do not activate PDF JavaScript, embedded executables, attachment links, or external URLs automatically.
- Clear document state on replacement or close. Do not persist files by default. Host parser assets locally with the application; no document-dependent network requests.

## Architecture proposal

- TypeScript + React + Vite for the static application, matching the user's stack preference. The initial implementation uses these dependencies.
- Initialize using the official shadcn/ui Vite template with Base UI selected. Use shadcn/ui components for standard controls, dialogs, menus, tabs, tooltips, and other applicable UI; build specialized object/hex exploration surfaces in React using the same styling conventions.
- Use the template's Tailwind CSS setup and a simple neutral default theme. Defer bespoke theming; preserve accessible contrast and focus states.
- Keep the application a client-rendered SPA. Routing is optional if later navigation needs justify it; no server-rendering framework is required.
- Node.js runs development tooling, tests, and production builds. PDF inspection runs in the browser; no Node.js server is required for normal use.
- Prefer JavaScript/TypeScript parser dependencies and keep application and worker integration code in TypeScript. A parser compiled from another language to WebAssembly remains a fallback; none has been selected for inspection. Explain the language, benefit, and maintenance/build implications to the user before adopting that fallback or changing the application stack.
- A small shared selection/history store drives the panes.
- UI retains immutable source bytes for hex access; a dedicated worker owns parser state. Any transfer/copy strategy must account for worker memory copies.
- A parser adapter exposes capabilities, summaries, object enumeration, object values, source locations, stream decoding, reference indexes, and diagnostics. Requests carry document IDs and cancellation IDs so stale results cannot update a newly opened file.
- Preserve raw dictionary entries, string bytes, duplicate-key information where available, and unknown syntax separately from convenience summaries. Missing fidelity must be explicit.
- Parse objects and decode streams lazily; run resource/reference indexing in cancellable batches. Version index results so partial results cannot be mistaken for a complete graph.
- Cache decoded streams under a bounded eviction policy. Use virtualized lists for objects, stream text, and hex.
- Optional page rendering prefers EmbedPDF, using its headless React integration or engine directly so shadcn/ui + Base UI remain responsible for application controls. Evaluate EmbedPDF first to avoid an unnecessary migration from PDF.js. PDF.js remains an acceptable temporary fallback if demonstrably easier.
- EmbedPDF's local engine runs PDFium compiled to WebAssembly in a Web Worker. This is a third-party compiled engine dependency; application and integration code remain TypeScript/React. Explain that distinction before introducing the dependency, as requested for non-TypeScript engines. Use local processing and self-hosted build assets, not a cloud engine.
- Keep a small preview adapter boundary for document opening, page rendering/navigation, zoom, and cleanup. Inspection and byte provenance stay independent of the preview engine. Neither EmbedPDF nor PDF.js rendering support proves access to arbitrary PDF objects or exact original source spans; assess those separately in the parser spike.

### Parser feasibility checkpoint: first implementation task

Evaluate the parser before polishing the interface. Start with an established JavaScript/TypeScript-compatible engine, such as a PDF.js-based inspection adapter or a maintained alternative. If these cannot meet the provenance contract, evaluate a QPDF WebAssembly adapter as a fallback and explain that QPDF is implemented in C++ before adopting it. QPDF's documented native/JSON interfaces support semantic inspection. They do not establish a ready browser build or exact source-span API. JSON alone is insufficient evidence for faithful byte mapping.

Prove in the browser:

- Enumerating ordinary and compressed objects using original object IDs.
- Resolving current cross-reference entries across updates and hybrid structures.
- Retrieving unmodified stream dictionaries and verified original object/stream boundaries.
- Representing compressed-object locations in decoded containers.
- Decoding the required sample filter chains without rewriting the source document.
- Reporting recovery and unsupported capabilities without silently normalizing away relevant structure.
- Packaging, licensing, bundle size, memory use, cancellation, and browser compatibility.

Produce a short capability matrix, pinned dependency choice, fixture results, and any needed adapter instrumentation. Prefer adapting an established engine to writing a full PDF parser. If no engine can meet the provenance contract within a reasonable spike, report the limitation and revisit scope or platform before committing to the UI architecture.

## Delivery sequence and acceptance

1. Parser proof: pass the capability checkpoint on simple, object-stream, hybrid, and incrementally updated fixtures. Record unsupported cases.
2. Core vertical slice: local file -> object list -> readable dictionary -> reference navigation -> original hex range. Validate back/forward and document replacement.
3. Exploration: catalog/pages/resources, overview, inherited resources, incoming links, key explanations, stream decoding, and bundled samples.
4. Search and resilience: scoped search, limits, cancellation, partial states, encrypted-file state, and malformed-input handling.
5. Release: keyboard and responsive checks, browser compatibility, documentation, deployment, and a short observed usability session.

Optional page preview follows the core inspection release. Image/font previews, operator explanations, visual click-to-object mapping, graph visualization, persistent bookmarks, editing, repair, AI explanations, and comparisons remain later work.

## Verification and success criteria

- Use redistributable fixtures covering each supported primitive, classic and stream xrefs, object streams, hybrid files, incremental replacement, inherited resources, cyclic/dangling references, required filters, encryption, truncation, and corrupt xrefs.
- Check parsed object identities and relationships against a trusted native tool. Check source spans independently against fixture byte ranges, including binary data containing misleading `obj` or `endstream` text.
- UI integration checks cover selection synchronization, reference navigation/history, search scopes, document replacement, decoding errors, and source-versus-decoded offsets.
- Browser end-to-end checks cover local opening, sample exploration, keyboard use, cancellation, and absence of document-content network traffic.
- Starting performance targets: on a recorded desktop/browser baseline, a representative 10 MiB fixture becomes navigable within 3 seconds; cached object navigation within 100 ms; parsing produces no main-thread stall over 100 ms. Measure and record the baseline during the spike. These were planning targets, with measurements still pending at the time.
- Compatibility target: current stable Chrome, Firefox, and Safari at release time; verify in CI where practical and perform a Safari smoke test.
- A developer unfamiliar with a sample can find a page's content stream, follow a resource reference, and distinguish original from decoded bytes within five minutes without coaching.

## Distribution and project documentation

Publish the source on the existing GitHub repository and deploy a static site. Choose the hosting provider during implementation. CI runs type checking, meaningful parser/UI tests, and a production build; publishing is a separate release action.

README explains local development, browser support, privacy behavior, supported filters/features, limits, known fidelity gaps, and sample licenses. Select the project license and confirm compatibility with the chosen engine before a public release.

## Open decisions

- Parser and any necessary provenance instrumentation, resolved by the first spike.
- Final performance/size budgets, informed by measured browser behavior.
- Project license, static hosting provider, and visual identity.
- Detailed scope is proposed; the user's browser/local-processing preference is confirmed.

## Next action

Collect the minimal, compressed-object, and resource-rich sample PDFs with redistribution rights. Use them to run the parser capability spike and demonstrate the page -> content stream -> original/container bytes journey before investing in visual polish.

## Sources and technical basis

- [QPDF object and cross-reference streams](https://qpdf.readthedocs.io/en/stable/object-streams.html): compressed-object containment, xref variants, and hybrid/update relationships.
- [QPDF JSON](https://qpdf.readthedocs.io/en/stable/json.html): semantic object representation, stream handling, and normalization caveats. Original source bytes must be retained separately.
- [QPDF library interfaces](https://qpdf.readthedocs.io/en/stable/library.html): native interfaces; browser adapter feasibility remains to be proved.
- [PDF.js](https://mozilla.github.io/pdf.js/) and [public document API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html): rendering candidate, not proof of an exact source-span inspection API.
- [EmbedPDF headless React setup](https://www.embedpdf.com/docs/headless/react/setup) and [local engine setup](https://www.embedpdf.com/docs/engine/setup): preferred preview integration, React/Vite support, local WebAssembly worker, and self-hosted assets. Check installed major-version documentation before implementation; versioned older documentation uses different package names.
- [shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite) and [Base UI support](https://ui.shadcn.com/docs/changelog/2026-01-base-ui): official initialization path for the selected component stack.

## Planning observations

- The user described the goal as viewing the internal hex/structure, establishing both logical and physical representations as core requirements.
- The user chose developers exploring unfamiliar PDFs, so discovery paths and navigation take priority over editing and validation workflows.
- The user confirmed browser delivery, making engine feasibility and local processing explicit architectural constraints.

## Independent plan review

One review round covered completeness, consistency, clarity, scope, and feasibility. The review passed at 9/10, with no material revisions requested. The reviewer identified browser parsing with trustworthy source locations as the principal risk and confirmed that the early capability checkpoint addresses it. At the time of this document review, implementation feasibility and performance had not been tested. The subsequent clarifications of the user's TypeScript/React/Node.js and shadcn/ui + Base UI Vite SPA preferences have not undergone another independent review.
