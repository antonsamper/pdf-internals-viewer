# PDF Internals Viewer
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-selected TypeScript, React, Vite SPA, shadcn/ui with Base UI, and Node.js tooling. EmbedPDF is preferred for local page preview. Explain any new non-TypeScript engine before adopting it.

## Users
Developers exploring unfamiliar PDFs to understand their structure.

## Product Purpose
Connect readable PDF objects and their relationships to immutable original file bytes. Success means following a page to its content stream and understanding where the data lives.

## Operating Context
A read-only, desktop-first browser workspace with object navigation, inspection, and hex. Files stay on the device. Partial parsing and unsupported features must be explicit.

## Capabilities and Constraints
One document at a time. Local file opening and bundled samples. Worker-based parsing, source provenance, reference navigation, raw/decoded streams, and scoped search. Preview rendering is independent of original-byte inspection. See docs/PLAN.md for staged scope.

## Brand Commitments
Theme is low priority. Use neutral defaults and shadcn/ui components. Do not introduce a brand exploration step before functional implementation.

## Evidence on Hand
User-approved product and stack direction in docs/PLAN.md. No existing application or supplied PDFs at project start. Sample fixtures must be original or redistributable.

## Product Principles
- Preserve source truth.
- Make relationships navigable.
- Keep files local.
- Explain partial results.

## Open Decisions
Parser choice is subject to a capability spike. First launch shows an empty workspace with Open PDF and sample choices, as confirmed by the user.
