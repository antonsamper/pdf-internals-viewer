# EmbedPDF validation backport

## What changed

EmbedPDF 3.1.0 requires Zod 3.25.76. There is no compatible upstream Zod 3 release fixing [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). An unreviewed Zod 4 override would change APIs used by the engine.

`scripts/prepare-preview.mjs` instead applies a narrow local backport of the early collection-bound rejection represented by [the upstream fix](https://github.com/colinhacks/zod/commit/a0ebf97). It preserves the existing v3 API and existing size-error creation:

- Arrays with `.max()` or `.length()` reject excessive length before iterating elements or allocating per-element parse results.
- Sets with `.max()` or `.size()` reject excessive size before iterating elements or scheduling async validation.
- Valid collections and ordinary validation failures within the bound retain their previous behavior.

For oversized invalid collections, validation now returns the existing size error immediately, without collecting an error for every element. Zod 3 maps have no corresponding maximum-size API, so this is not a map-schema migration.

## All shipped copies are covered

Patching the installed Zod modules alone is insufficient. EmbedPDF also ships precompiled assets containing their own copy of the validator. The preparation script checks and patches:

1. Engine-resolved Zod `v3/types.js` (ESM).
2. Engine-resolved Zod `v3/types.cjs` (CommonJS).
3. `@embedpdf/engine/workers/embedpdf-worker.js`.
4. `@embedpdf/engine/workers/inline-transport.js`.
5. `@embedpdf/engine/workers/embedpdf-worker.source.js`, which contains the worker as a JSON-escaped JavaScript string.
6. `@embedpdf/engine/dist/embedpdf-worker.source-B-pv2k2b.js`, the ESM distribution chunk imported by the client.
7. `@embedpdf/engine/dist/embedpdf-worker.source-DQ7ekBUy.cjs`, its CommonJS counterpart.

The distribution chunks contain JavaScript string literals with raw tab characters. The preparation script normalizes those tabs for JSON decoding and verifies that each decoded payload matches the complete original worker hash before changing it. Original wrapper text and exports remain intact; the modified payload is serialized as a valid JSON string literal.

The Node transport wrapper is checked by its exact hash and contains imports rather than another vendored validator. The engine-resolved module patch covers those imports. The encoder worker does not contain Zod.

The script requires EmbedPDF/core 3.1.0 and Zod 3.25.76. It resolves the installed engine, then that engine's core dependency, then that core's Zod dependency. Unrelated hoisted or tooling copies stay unchanged.

Every modified artifact has recorded original and patched SHA-256 hashes. The script validates all candidates before writing and rejects unexpected input. Repeating it makes no further changes. Before patching the escaped worker, the script verifies that its decoded content matches the exact pinned standalone original.

This preparation step modifies installed dependency files; the inspection adapter generator leaves them unchanged. Use the project pnpm installation, development, test, and build scripts so it runs reproducibly. Dependency upgrades must review the hashes, minified anchors, regression evidence, and upstream support before changing these pins. The pnpm configuration copies installed files and disables side-effects caching so this patch cannot alter shared store contents. The project maintains this patch locally; it has not been released upstream.

## Modified-file notices

Every modified EmbedPDF worker, inline transport, and embedded-source module begins with a prominent `/*! Modified by PDF Internals Viewer: ... */` notice naming the validation-bound backport. Each decoded worker string also begins with the notice, so a Blob fallback carries its own modification notice inside the executable payload. Existing upstream wrapper text, exports, and notices are preserved.

The banner uses a legal-comment form intended to survive bundling/minification. Check the emitted production workers and fallback payloads after building; static installation coverage alone does not establish notice retention in deployed files. Third-party license and notice distribution is handled separately from this change notice.

The script accepts only the exact original hashes, the exact current banner-bearing patched hashes, or the explicitly recorded previous backport hashes that lacked banners. This narrow legacy migration restores the previous payload to the original by undoing only the two known guards and verifying its complete original hash, then reapplies the guards and notices. Unknown bytes remain an error. Fresh upstream installations and known previous installations produce the same pinned artifacts with banners. An installation that already matches requires no writes.

## Verification

`tests/preview-validation.test.ts` runs the same synchronous/asynchronous array and Set tests against both installed module formats and all five bundled representations. The bundled tests evaluate the complete installed JavaScript in an isolated VM, exposing the bundle's existing Zod namespace instead of starting its worker or transport. They do not reimplement or mock validation, and do not load WASM or contact a network.

For each bundled representation, the test asserts that both its installed file and executable payload carry the exact modification banner. The baseline removes only that known banner and reverses the two guards, then verifies that the complete executable asset's original hash is restored. The original code visits all 20,000 invalid elements and emits 20,001 issues for an array capped at two items. Patched versions visit zero elements and emit one size issue. Valid transformations and ordinary within-bound failures are also tested.

All 54 validation tests passed for this change. Browser preview checks and a production rebuild remain required after install-script changes, because testing external Zod modules alone would miss an unpatched bundled worker.

## Scope and remaining audit state

This is a targeted mitigation for oversized constrained collections. It does not impose a universal size limit on unbounded schemas, prove every engine operation safe, cap overall browser memory, or replace worker/file/resource limits.

`pnpm audit` remains version-based: the installed dependency still reports Zod 3.25.76 and the report contains one high-severity advisory. The previous npm audit counted five propagated affected package entries for this same Zod advisory. The project does not suppress the advisory, falsify the package version, or report a clean audit. The local mitigation and regression tests are evidence separate from the registry's version assessment. Replace this backport with a compatible upstream fix when available; do not retain it indefinitely merely because its tests pass.

## Production preservation

Vite 8 normally strips legal comments while minifying, so a banner in an installed dependency is insufficient evidence. `vite.config.ts` explicitly preserves Rolldown legal comments before chunk hashing. The `postbuild` hook runs `scripts/check-preview-notices.mjs`, which reads emitted assets, lexes outer comments and parses the embedded worker string to verify that both module and executable Blob payload retain their modification notices. It never modifies hashed output.

Dependency resolution follows the installed `@embedpdf/engine` → its `@embedpdf/engine-core` → its Zod dependency chain. A core package hoisted to the application root may be a different copy. A mixed pnpm installation reproduced why that distinction matters.
