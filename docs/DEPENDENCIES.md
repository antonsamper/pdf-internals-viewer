# Dependency audit notes

Checked with `npm audit --json` on 2026-11-11 against the initial installed lockfile. The initial report contained **20 package findings**, caused by three underlying advisories rather than 20 separate vulnerabilities. Re-run `npm audit` after dependency changes; the counts below describe that initial snapshot.

## Findings and practical exposure

| Underlying dependency | Advisory | Initial paths | Practical exposure and response |
| --- | --- | --- | --- |
| Zod 3.25.76 | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), high: memory exhaustion while validating oversized collections; affected `<4.6.6`, patched `4.6.6` | `@embedpdf/engine` → `@embedpdf/engine-core` → `zod`; five high package findings through propagation | EmbedPDF 3.1.0's engine-core declares `zod: ^3.23.8`. The latest stable Zod 3 version available at this check is 3.25.76, with no patched v3 release. The engine package uses Zod in schema, wire, and annotation validation. Our read-only preview does not call annotation-writing APIs, but this does **not** establish that all vulnerable paths are unreachable. Retain file/render limits and worker isolation, track the upstream dependency, and recheck before release. |
| minimatch 10.2.6 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate: glob-pattern amplification/denial of service; affected `>=7.0.0 <11.0.1`, patched `11.0.1` | ESLint, typescript-eslint, and shadcn's ts-morph dependency; thirteen moderate package findings through propagation | These are tooling paths, not the PDF inspection/rendering interface. The current project supplies its own glob patterns rather than taking patterns from PDFs. Prefer upstream dependency updates; an override to minimatch 11.0.1 crosses a major version and requires lint/build/test verification. |
| deepmerge 4.3.1 | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), low: prototype poisoning | shadcn CLI and `@shadcn/registry`; two low findings | Component generation uses the CLI; the shipped UI does not invoke the CLI or merge untrusted PDF objects with deepmerge. Keep CLI tooling out of application imports. Moving shadcn to development dependencies can reflect its actual role, but does not remediate the advisory itself. The generated stylesheet currently imports `shadcn/tailwind.css`, so removing the package without changing stylesheet/build setup is not a safe drop-in fix. |

## Why not force the audit fixes

`npm audit fix --force` initially proposed downgrading shadcn to 1.0.0 and ESLint to 9.39.5. Those changes can break the chosen current Base UI template and lint configuration. An audit fix suggestion is not evidence of compatibility.

Overriding EmbedPDF's Zod 3 dependency with Zod 4 also changes a major API version. There is no established compatibility guarantee from EmbedPDF for that substitution. Do not suppress the report or force that override solely to obtain a clean count. Prefer an upstream-compatible fix, a reviewed patch with meaningful coverage, or an explicit dependency decision before release.

These observations are a dependency review, not a claim that untrusted PDFs are safe or a substitute for parser limits and runtime checks.

## Preview assets

An isolated **normal application-mode** Vite 8 production build of `PdfPreview` emitted:

- `assets/embedpdf-*.wasm`: about 7.88 MB uncompressed / 3.23 MB gzip.
- `assets/embedpdf-worker-*.js` and `assets/encoder-worker-*.js`.
- A generated `wasm-url` chunk resolving the WASM to the application's `/assets/` path.

The preview uses `localEngine()` and opens a byte-buffer copy. No cloud engine, remote document URL, or CDN WASM configuration is used. Lazy-load the preview component so engine assets are requested only when needed. Actual browser network verification remains part of the application's integration smoke test.

## Repeat checks

Run `npm audit` for the complete toolchain and `npm audit --omit=dev` for dependency classification. Classification alone does not prove a package is in the browser bundle: inspect the production build and imports. Check upstream EmbedPDF's Zod dependency again before public release.
