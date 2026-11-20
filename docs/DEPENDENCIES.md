# Dependencies

## Tech stack

| Area | Packages |
| --- | --- |
| App | React 19, Vite 8, TypeScript 6 |
| UI | Tailwind CSS 4, shadcn/ui components on Base UI, Lucide icons, Geist font |
| PDF inspection | `@libpdf/core` 0.5.3, pinned exactly |
| Page preview | `@embedpdf/engine` 3.1.0 (PDFium compiled to WebAssembly), pinned exactly |
| Tests | Vitest, Playwright |
| Code quality | Oxlint, Oxfmt, React Doctor, Husky and lint-staged for the pre-commit hook |
| Hosting | Wrangler 4.160.1 for Cloudflare Pages, pinned exactly |

These three packages are pinned exactly because the preparation scripts below check those versions by hash. Upgrading `@embedpdf/engine` also needs the [notice review](NOTICES.md#upgrading-embedpdf), and upgrading `@libpdf/core` needs the [instrumentation review](PARSER.md#instrumentation-and-reproducibility).

## Package manager

Use pnpm 10.33.4 (pinned in `package.json`) with Node.js 22.18 or later. `pnpm-lock.yaml` is the only lockfile; CI installs with `pnpm install --frozen-lockfile`.

`pnpm-workspace.yaml` applies these settings whatever the user's own pnpm config says:

- `ignoreScripts: false` and `enablePrePostScripts: true` keep the project's own hooks running even when a user's global config disables scripts. The hooks generate the parser adapter, apply the preview security patch and run the notice checks after each build. Dependency install scripts stay blocked, except the two packages allowed below.
- `strictDepBuilds: true` and `allowBuilds` allow install scripts only for Wrangler's esbuild 0.28.2 and workerd 1.20261110.1. Any other dependency that wants to run one fails the install until it is reviewed.
- `packageImportMethod: copy` and `sideEffectsCache: false` keep the patched preview files out of pnpm's shared store.
- `minimumReleaseAgeExclude` exempts `lucide-react@1.72.0` from the minimum release age.

## Preparation scripts

`prepare:deps` runs two scripts. The `postinstall`, `predev`, `prebuild`, `pretest` and `pretest:corpus` hooks call it.

- `prepare:preview` (`scripts/prepare-preview.mjs`) patches Zod's collection validation inside EmbedPDF for a known advisory. See [PREVIEW-VALIDATION.md](PREVIEW-VALIDATION.md).
- `prepare:parser` (`scripts/prepare-parser.mjs`) generates the LibPDF inspection adapter. See [PARSER.md](PARSER.md).

Both scripts check exact package versions and SHA-256 hashes and refuse to run against anything they do not recognise. If you install with `--ignore-scripts`, run `pnpm run prepare:deps` afterwards.
