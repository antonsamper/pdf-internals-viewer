# Third-party notice preparation

Recorded 2026-11-12. **Status: draft; public-release notice work remains open.** No license has been selected or added for this application's original code.

## Prepared artifacts

- `public/THIRD-PARTY-NOTICES.txt`: available license/notice texts for 42 installed runtime dependency packages, deduplicated into 31 distinct texts, plus the existing shadcn/ui notice. Its draft/native-gap status is explicit.
- `public/licenses/notice-sources.json`: actual installed names/versions, declared licenses, source paths, and SHA-256 hashes for every copied text.
- `public/licenses/embedpdf-apache-2.0.txt`: unmodified installed EmbedPDF runtime package license, including CloudPDF's copyright and the Apache 2.0 text.
- `public/licenses/embedpdf-core-fonts-third-party.txt`: unmodified notice specifically supplied with EmbedPDF's core-font package, including PDFium's BSD terms.
- `public/licenses/noto-apache-2.0.txt`: the exact Noto license supplied by the fallback-font package. The combined notice also preserves the package README's Noto copyright/trademark statements.
- `public/licenses/geist-ofl.txt`: the complete installed Geist SIL Open Font License text.
- `public/licenses/libpdf-mit.txt`: LibPDF's installed MIT license; it is now present in public materials as well as the generated source directory.
- Existing `public/licenses/shadcn.txt` remains untouched.

All copied license texts come from installed package files or the existing vendored shadcn license. No generic license text has been substituted for a package's own copyright notice. This inventory is deliberately conservative: some listed runtime package code may be tree-shaken from a particular build. `@tailwindcss/vite` and its build-only dependency graph, development dependencies, and native platform binaries are not treated as browser-distributed runtime components; the actual Tailwind CSS license is retained.

The TypeScript inspection adapter also brings in `lru-cache` 11.5.3 under BlueOak-1.0.0 and pako under MIT AND Zlib. Their supplied texts are included; assuming all dependencies are MIT would miss these details. Noble, ASN.1/PKI, React, Base UI/Floating UI, icons, resizing, CSS animation, font packages, and their runtime dependency notices are included by the resolved runtime graph.

## Public-release blockers and decisions

### 1. Obtain build-matched PDFium/native dependency notices

The installed `@embedpdf/engine-runtime-wasm32` 3.1.0 package says it is derived from PDFium, but its only supplied license file is CloudPDF's Apache 2.0 license. The installed package contains no PDFium revision/build manifest and no consolidated third-party/native notice inventory. Its `files` manifest lists the WASM/glue, README, and LICENSE; the inventory did not find a hidden notice directory. The runtime's public build ID is package version plus target, not a PDFium commit.

Observed WASM artifact:

- Package: `@embedpdf/engine-runtime-wasm32@3.1.0`
- File: `lib/embedpdf.wasm`
- Size: 7,880,343 bytes
- SHA-256: `7195838021c8318416117611b961614ab52eedcad585db5945681f86164e40f9`

`@embedpdf/core-fonts@3.1.0/THIRD_PARTY_NOTICES` is reliable evidence for the embedded standard-font package's PDFium BSD notice. It is **not evidence of the complete native third-party dependency set compiled into the WASM binary**. Do not rename it as a complete PDFium runtime notice file or claim native notices are finished.

Before public distribution, obtain the corresponding PDFium revision/build configuration and full native third-party license/notice bundle from the runtime supplier or the exact build used for that artifact. Include those verified texts with the distribution and record their provenance. The current upstream source branch's license is useful background, but a moving branch is not proof of which third-party code was compiled into this package.

Primary upstream references:

- Installed package README and package manifest: `node_modules/@embedpdf/engine-runtime-wasm32/`.
- [EmbedPDF runtime source license](https://github.com/embedpdf/runtime/blob/embedpdf/main/LICENSE): contains PDFium licensing terms; not claimed to identify the installed binary revision.
- [EmbedPDF runtime project](https://github.com/embedpdf/runtime): source/build provenance needs to be matched to the installed artifact.

### 2. Modification notices added; verify emitted release assets

The installed EmbedPDF Apache 2.0 license section 4(b) requires modified files to carry prominent notices that they were changed. The collection-bound backport changes worker/transport files and embedded worker source representations. The review initially found that the minified assets lacked a project-specific modification banner. The preparation script has now been updated with deterministic prominent notices in modified module files and executable worker payloads, while retaining exact-hash migration and original-baseline tests.

Release preparation should add a deterministic, prominent change notice to each modified Apache-licensed worker/transport artifact and relevant embedded-source wrapper/payload, preserving original notices. The source hashes, generated-patch hashes, upstream-reproduction tests, and resulting build checks must be updated together. The coordinator and release-review agent own this implementation; production minification also needs to retain the notices. Do not mark this gate complete from source-package banners alone.

LibPDF's MIT license and the Zod MIT license are retained separately. This finding concerns the Apache-licensed EmbedPDF files, not a claim that all modified packages have the same requirements.

### 3. Project license selected; make notices discoverable

The user selected MIT for original application code on 2026-11-12. The coordinator added the root `LICENSE` and package metadata. Third-party dependencies retain their own licenses; this selection does not resolve the native notice gap.

After the remaining notice gaps are closed, make the served notice material discoverable from the site's About/limitations area or another accessible credits link, and verify that the final static build includes the text/license files. Do not label this draft as completed release licensing before those actions.

## Revalidation boundary

Before the package-manager migration, the installation was a pnpm symlink layout even though the checked-in workflow used npm. All runtime packages in this prepared graph matched the expected application versions at inspection; a separate lock comparison found installed Vite 8.3.7 versus npm lock 8.3.8, which is build tooling and excluded from these runtime notices. A clean canonical install and final production build were required to recheck the resolved runtime graph and notice hashes; see the pnpm verification below.

No application code, package manifests, lockfiles, build outputs, or project-license choice were changed by this notices task. The existing shadcn notice was preserved. The report is an artifact/provenance inventory and identifies concrete unfinished distribution work; it is not a declaration that every licensing obligation has been completed.

## Canonical-candidate cross-check

The coordinator checked all 43 recorded notice-source entries against the isolated clean npm-lock installation; all source texts matched their recorded SHA-256 hashes. This supports the prepared JS/font/CSS notice provenance across the two layouts. It does not fill the native WASM dependency gap or replace final artifact verification. Results are saved in `.context/canonical-notice-verification.json`.

## Modification-notice verification

Completed in the isolated canonical npm candidate: Vite's production default stripped legal comments from the inline transport. The build now preserves Rolldown legal comments before hashing, and `postbuild` runs the read-only `check:preview-notices` assertion. The rebuilt standalone worker, inline transport, embedded-source outer module and its decoded Blob payload all passed. Hashed assets were not rewritten after generation. This closes the modified-file-banner finding for that candidate; the build-matched native PDFium notice gap remains open.


## Pnpm migration verification — 2026-11-12

The user selected pnpm. A fresh `pnpm install --frozen-lockfile` using pinned pnpm 10.33.4 ran both preparation steps successfully. All 43 recorded notice-source texts matched the clean installed tree (`.context/pnpm-notice-verification.json`). The root production build and its read-only postbuild assertion verified all three preview asset groups, including the embedded fallback payload. The native PDFium/build-matched notice gap remains open.
