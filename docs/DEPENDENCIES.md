# Dependency audit and remediation

## Current status

The initial npm lockfile reported **20 package findings**: 2 low, 13 moderate, and 5 high, tracing to three underlying advisories. After remediation and the pnpm migration, `pnpm audit` and `pnpm audit --prod` both report **one high-severity Zod advisory**, with no low/moderate findings. The previous npm audit counted five affected package entries propagated from that same advisory; the count difference reflects audit reporting, not an additional fix.

This is not a zero-advisory dependency tree. The Zod dependency retains its actual published version, so the version-based audit report remains visible. A narrowly scoped, reproducible local backport addresses the tested oversized-constrained-collection behavior, including validator copies prebundled into the preview workers. No advisory is suppressed or hidden by changing a package's declared version.

Re-run audits after updates; the recorded counts describe the checked lockfile, not a guarantee about future advisories.

## Changes

### Removed the build-time shadcn CLI dependency

The application uses checked-in shadcn/ui components with Base UI. It does not need to install or execute the component-generation CLI during normal development, builds, or deployment. Removing the CLI removed its deepmerge, registry, MCP, and ts-morph dependency paths.

The exact shadcn 4.23.0 `tailwind.css` file is vendored at `src/styles/shadcn.css`, with the original MIT notice. Its license is also served at `/licenses/shadcn.txt`. `src/index.css` imports that local file, preserving component variant behavior without the CLI package. Future component generation remains a separate developer operation and should include a fresh tooling/dependency review.

This removes the project's path to [deepmerge prototype poisoning, GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), which currently has no patched upstream release.

### Scoped minimatch upgrade

[minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) affects versions 7 through 11.0.0. The lockfile now resolves **11.0.7** for the three inspected consumers: ESLint, `@eslint/config-array`, and `@typescript-eslint/typescript-estree`.

Version 11 is not generally a drop-in replacement: it removes APIs including `makeRe`, `AST`, and `matchOne`, and changes internal structures. Overrides are scoped to the inspected parents rather than applied globally. Their installed code uses `minimatch()`, `new Minimatch().match()`, the partial-directory argument, and `.pattern`, which remain supported. `tests/tooling-globs.test.ts` verifies those consumer-resolved APIs, hidden files, TS/TSX brace patterns, directory traversal, and negation. Full lint, type checking, builds, and browser tests also exercise the actual toolchain. Recheck these assumptions whenever updating the consumers or matcher.

### EmbedPDF validation backport

EmbedPDF 3.1.0 still depends on Zod 3.25.76; no compatible upstream Zod 3 patch was available for [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). A forced Zod 4 override would change APIs without an upstream compatibility guarantee, and would leave separately prebundled copies untouched.

`scripts/prepare-preview.mjs` instead installs a narrow array/Set bound-check backport into the exact pinned ESM/CommonJS validators and preview bundles. It validates original and patched SHA-256 hashes, verifies package versions, is idempotent, and refuses unexpected files. All targets are validated before any writes. The lifecycle hooks run it before development, tests, and builds, as well as after installation.

The regression tests exercise the actual validators, including the validators inside installed worker bundles. With a 20,000-item input exceeding a schema bound, the original performs 20,000 element visits and records 20,001 issues; the backport rejects it before visiting any elements and records the existing size issue. Tests also preserve valid parsing/transforms and ordinary within-bound validation failures. See [backport scope and evidence](PREVIEW-VALIDATION.md).

This is a local maintenance obligation, not an upstream release or general memory guarantee. Unbounded schemas still need application-specific limits; worker timeouts, file limits, and bounded decoding remain relevant. The version-based advisory remains reported until the dependency can be upgraded or replaced through a compatible upstream change.

## Package-manager contract

Use **pnpm 10.33.4**, pinned in `package.json`, with `pnpm-lock.yaml` as the sole lockfile. Node.js 22.18+ is required. CI installs pnpm before enabling the Node action's pnpm store cache and uses `pnpm install --frozen-lockfile`.

`pnpm-workspace.yaml` carries the three parent-scoped minimatch overrides. Consumer regression tests follow the actual ESLint/typescript-eslint dependency chains rather than relying on hoisted packages. The generated parser resolves every external import through LibPDF's own dependencies, including its browser-specific lru-cache entry.

Project-local `ignoreScripts: false` and `enablePrePostScripts: true` preserve installation and pre/post command hooks. Wrangler's exact esbuild 0.28.2 and workerd 1.20261110.1 platform-binary verification hooks are allowed. `strictDepBuilds: true` makes any new dependency build hook fail for explicit review instead of silently skipping it. The application's own preparation scripts still run.

Because the preview preparation script modifies installed dependency files, `packageImportMethod: copy` and `sideEffectsCache: false` keep those modifications out of the shared content-addressed store. This deliberately trades hard-link speed for isolated, reproducible patching. The existing lucide-react release-age exception is preserved.

## Verification and release considerations

- `pnpm install --frozen-lockfile` must succeed and apply both preparation scripts; using `--ignore-scripts` without subsequently running `pnpm run prepare:deps` skips the backport and generated parser.
- `pnpm test` includes the validation backport and scoped glob-compatibility regressions.
- The production build must emit the patched worker assets, not stale prebuilt files. Build before browser tests; avoid testing a development server while other jobs rewrite generated modules and trigger HMR.
- Preview remains lazy-loaded, uses local byte input and a worker, and serves WASM/workers from this application's build. Tests verify no external document requests in the tested preview flow.
- Track an upstream-compatible EmbedPDF/Zod update so the local backport can be retired after its behavior tests pass against the replacement.
- The project uses MIT; complete third-party notices, and validate hosting headers/worker/WASM loading before public deployment. This dependency work does not publish the application.
