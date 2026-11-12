# Release-hardening review

Reviewed 2026-11-12 against `ad644cc`. Scope: the uncommitted dependency preparation, validation backport, scoped glob overrides, corpus harness, and browser CI changes. This review did not install dependencies, regenerate modules, or build shared assets.

## Findings

### P1 — Resolve the standalone validator through the actual preview engine

`scripts/prepare-preview.mjs` resolves `@embedpdf/engine-core/package.json` directly from the application root. `tests/preview-validation.test.ts` repeats that lookup. Neither lookup proves it is the core package loaded by the installed `@embedpdf/engine`.

The current mixed npm/pnpm workspace demonstrates the failure: the actual engine resolves a pnpm core whose Zod ESM file has the original SHA-256 `9763a2938f0e7f983363ef4bf6530e7583e3f2d54f8a4a6684efad58febc6e8e`. The application-root core resolves a different Zod copy with the patched hash `839a85dd365ba812fea06fa30679a8fea3e3fbde2c046880aabd39c355ccac54`. Thus the standalone-module tests can pass while a validator reachable through the actual engine remains unpatched. The bundled-worker tests resolve from the actual engine separately and do not establish standalone-module coverage.

Required fix: resolve the installed engine package first, use `createRequire(enginePackageFile)` to resolve its core dependency, then resolve Zod relative to that core. Use the same dependency chain in the tests. Validate both module formats. Retain all existing version/hash guards.

### P2 — Current dependency tree does not match the recorded npm override evidence

A fresh read-only `node node_modules/vitest/vitest.mjs run` produced **81 passing / 1 failing** tests. The failing case is the ESLint consumer's reviewed minimatch release: its actual pnpm dependency resolves `10.2.6`, while the test requires `11.0.7`. The other two root-resolved consumers use extraneous npm copies, so their passing assertions do not establish which versions the actual ESLint dependency chain uses.

Required action: normalize a clean install using the project's declared package-manager contract, then rerun validation. Do not delete or reconcile the untracked pnpm files without confirming their ownership/intended use. Strengthen scoped-consumer checks to follow the actual root tool's dependency chain where necessary, rather than unrelated hoisted/extraneous copies. If pnpm is to be supported, its overrides and patch lifecycle require explicit verification.

## Positive evidence

- The backport validates exact original/patched hashes before writing and is idempotent. All seven executable artifacts are represented, including the distribution-embedded fallback sources. Oversized collection tests exercise real bundled validators and restore exact-hash upstream baselines.
- Scoped minimatch overrides avoid a global major-version replacement; inspected APIs and regression cases are relevant to the current callers.
- Corpus downloads are opt-in, commit/hash/size pinned, kept out of public assets/source control, and parsed in bounded subprocesses. Partial recovery and unknown source ranges are explicitly distinguished from full oracle matches.
- CI separates unit/build checks from a production-browser matrix, reducing the HMR interference observed during earlier development runs.
- Five propagated npm audit findings remain openly documented; the tree is not described as zero-advisory.

## Required validation after the findings are fixed

1. Resolve and record the actual engine → core → validator chain, including ESM/CommonJS hashes.
2. Use a clean canonical installation; verify preparation succeeds twice without changes and unexpected hashes fail closed.
3. Run type checking, lint, all unit tests, the opt-in corpus suite, and the production build.
4. Run the nine production browser tests in Chromium, Firefox, and WebKit against the final built assets. Preserve actual Safari as a separate task.
5. Review deployment notices/license coverage and hosting worker/WASM behavior before publication.

## Readiness

**Changes required** for the P1 dependency-resolution defect. Prior passing checks remain useful historical evidence but do not supersede the fresh failure above. No other material source defect was identified in this review scope. This is not a general PDFium/security audit or a public-deployment approval.

## Coordinator follow-up

The engine → core → validator resolution fix is now applied in the preparation script and tests. Against the actual pnpm-isolated dependency chain, the revised tests reproduced 12 failures in the unpatched standalone modules; after preparation, all 54 validation tests passed. Evidence is saved under `.context/preview-actual-dependency-before.log`. The mixed-tooling resolution remains pending the user's npm/pnpm choice. An isolated clean npm-lock candidate was installed and built without altering the root pnpm tree, for independent verification/performance work. These follow-up facts do not erase the original findings or replace the final clean-install gate.

The rebuilt isolated npm candidate passed 82 unit tests, lint, type checking and build. All 43 recorded dependency notice-source texts matched their hashes under its canonical npm layout. The newly added postbuild check also confirmed that modification notices survive minification in all three emitted preview asset groups, including the decoded fallback payload. Root package-manager reconciliation and the supplier's native PDFium notices remain open; this is not approval to publish.


## Package-manager reconciliation — 2026-11-12

The user authorized pnpm. The project now pins pnpm 10.33.4, uses only `pnpm-lock.yaml`, and configures CI with frozen installs and a pnpm store cache. Parent-scoped overrides moved to `pnpm-workspace.yaml`. Tooling regression tests resolve each consumer through the actual ESLint/typescript-eslint dependency chain. The generated parser relocates all external imports through LibPDF's own dependency chain, removing a separate hoisting assumption.

A fresh dependency tree installed with the frozen lockfile, running both preparation scripts through the project lifecycle configuration. The clean root passed 82 unit tests, 15 corpus tests, lint, type checking, production build, and emitted-preview-notice checks. All 43 recorded notice-source hashes matched. pnpm reports the same Zod advisory as one high finding (npm previously counted five propagated affected package entries); it is not suppressed. All 27 production browser tests also passed (9 each in Chromium, Firefox and WebKit). This resolves the package-manager finding. The native PDFium notice gap and other documented release work remain open.
