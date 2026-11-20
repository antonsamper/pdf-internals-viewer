# PDF Internals Viewer

Explore PDF objects, references, and streams alongside their original bytes, with an optional page preview. Inspection is read-only and happens locally in your browser.

**[Open the app](https://pdf-internals-viewer.pages.dev)** · [User guide](https://pdf-internals-viewer.pages.dev/guide) · [Worked examples](https://pdf-internals-viewer.pages.dev/examples) · [Limitations](https://pdf-internals-viewer.pages.dev/limitations)

## Run locally

Requires Node.js 22.18+ and pnpm 10.33.4 (pinned in `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Open the URL printed by Vite. Installation prepares the pinned parser and preview dependencies automatically; see [dependency setup](docs/DEPENDENCIES.md).

## Verify

```sh
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
pnpm run build
pnpm exec playwright install chromium firefox webkit
PLAYWRIGHT_PREVIEW=1 pnpm run test:e2e --browser=all
```

The build generates the static site in `dist/` and checks public pages and licence notices. Browser tests use production assets; see [browser verification](docs/BROWSERS.md) for other modes. The optional [independent PDF corpus](docs/CORPUS.md) has separate download and test commands.

Linting uses Oxlint and formatting uses Oxfmt, configured from [hive-mind-react](https://github.com/antonsamper/hive-mind-react). Run `pnpm run lint:fix` for automatic lint fixes and `pnpm run format` to format TypeScript/TSX files. CI checks linting and formatting. Husky installs the pre-commit hook during `pnpm install`: lint-staged fixes supported staged files, followed by TypeScript checking and React Doctor (`--scope changed --blocking warning`). The hook blocks commits when any step fails.

The copied lint configuration introduces stricter rules, including sorted object keys, function expressions and kebab-case filenames. Existing lint violations need resolving before the full lint check passes.

## Project documentation

- [Parser capabilities](docs/PARSER.md) and [preview engine](docs/PREVIEW.md)
- [Dependencies and known advisory](docs/DEPENDENCIES.md), [preview backport](docs/PREVIEW-VALIDATION.md), and [third-party notices](docs/NOTICES.md)
- [Public content and sample maintenance](docs/AEO.md)
- [Cloudflare hosting and deployment](docs/HOSTING.md)
- [Security policy and private vulnerability reports](SECURITY.md)

Built with TypeScript, React, Vite, and shadcn/ui using Base UI. Bundled sample PDFs are original fixtures; their generators and provenance are documented in [public content maintenance](docs/AEO.md#worked-debugging-examples).
