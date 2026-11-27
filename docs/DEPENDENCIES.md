# Dependencies

## Tech stack

| Area           | Packages                                                                   |
| -------------- | -------------------------------------------------------------------------- |
| App            | React 19, Vite 8, TypeScript 7                                             |
| UI             | Tailwind CSS 4, shadcn/ui components on Base UI, Lucide icons, Geist font  |
| PDF inspection | `@libpdf/core` 0.5.3, pinned exactly                                       |
| Page preview   | `@embedpdf/engine` 3.4.0 (PDFium compiled to WebAssembly), pinned exactly  |
| Tests          | Vitest, Playwright                                                         |
| Code quality   | Oxlint, Oxfmt, React Doctor, Husky and lint-staged for the pre-commit hook |
| Hosting        | Wrangler 4.160.1 for Cloudflare Pages, pinned exactly                      |

These three packages are pinned exactly. The notice check pins the EmbedPDF WebAssembly binary by hash, so upgrading `@embedpdf/engine` needs a [notice review](NOTICES.md#upgrading-embedpdf). The parser preparation script checks the `@libpdf/core` bundle by hash, so upgrading it needs the [instrumentation review](PARSER.md#instrumentation-and-reproducibility).

## Package manager

Use pnpm 10.33.4 (pinned in `package.json`) with Node.js 22.18 or later. `pnpm-lock.yaml` is the only lockfile; CI installs with `pnpm install --frozen-lockfile`.

`pnpm-workspace.yaml` applies these settings whatever the user's own pnpm config says:

- `ignoreScripts: false` and `enablePrePostScripts: true` keep the project's own hooks running even when a user's global config disables scripts. The hooks generate the parser adapter and run the notice checks after each build. Dependency install scripts stay blocked, except the two packages allowed below.
- `strictDepBuilds: true` and `allowBuilds` allow install scripts only for Wrangler's esbuild 0.28.2 and workerd 1.20261110.1. Any other dependency that wants to run one fails the install until it is reviewed.
- `minimumReleaseAgeExclude` exempts `lucide-react@1.72.0` from the minimum release age.

## Preparation scripts

`prepare:deps` runs `prepare:parser` (`scripts/prepare-parser.mjs`), which generates the LibPDF inspection adapter. The `postinstall`, `predev`, `prebuild`, `pretest` and `pretest:corpus` hooks call it. See [PARSER.md](PARSER.md).

The script checks the exact package version and SHA-256 hashes and refuses to run against anything it does not recognise. No install or build step modifies EmbedPDF or its dependencies. If you install with `--ignore-scripts`, run `pnpm run prepare:deps` afterwards.
