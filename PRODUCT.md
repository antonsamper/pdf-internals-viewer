# PDF Internals Viewer
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
The user chose TypeScript, React, a Vite SPA, shadcn/ui with Base UI, and Node.js tooling. EmbedPDF is preferred for local page preview. Explain any new non-TypeScript engine before adopting it.

## Users
Developers exploring unfamiliar PDFs to understand their structure.

## Product purpose
Help developers connect PDF objects and their relationships to the unchanged file bytes. A developer should be able to follow a page to its content stream and see where that data lives.

## Operating context
A read-only, desktop-first browser workspace with object navigation, inspection, and hex. Files stay on the device. Partial parsing and unsupported features must be explicit.

## Capabilities and constraints
Open one document at a time from a local file or bundled sample. Parsing runs in a worker. The app tracks source locations and supports reference navigation, raw and decoded streams, and scoped search. Preview rendering is independent of original-byte inspection. See docs/PLAN.md for staged scope.

## Brand commitments
Theme is low priority. Use neutral defaults and shadcn/ui components. Do not introduce a brand exploration step before functional implementation.

## Evidence on hand
The user approved the product and stack direction in docs/PLAN.md. The project started without an existing application or supplied PDFs. Sample fixtures must be original or redistributable.

## Product principles
- Preserve source truth.
- Make relationships navigable.
- Keep files local.
- Explain partial results.

## Open decisions
Parser choice is subject to a capability spike. First launch shows an empty workspace with Open PDF and sample choices, as confirmed by the user.
