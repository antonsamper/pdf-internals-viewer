# Scripts

Everything under `scripts/` supports the app but is not shipped to users. Some scripts run automatically on install, build or test. Others you run by hand.

## Run automatically

| Script                        | Runs from                                        | What it does                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepare-parser.mjs`          | `prepare:parser`, through `prepare:deps`         | Generates `src/generated/libpdf-inspection.mjs` from the pinned `@libpdf/core` 0.5.3 bundle. The adapter exposes the low-level parser, records byte provenance and caps decoded streams at 32 MiB. The output is not committed. See [PARSER.md](PARSER.md).                             |
| `build-prerender.mjs`         | `build`                                          | Renders every public page to static HTML after `vite build`, and writes `dist/sitemap.xml`. `/` and `/about` are filled in place. Every other route becomes its own `.html` file. See [PUBLIC-CONTENT.md](PUBLIC-CONTENT.md).                                                           |
| `check-title.mjs`             | the `commit-msg` hook and the PR checks workflow | Checks a commit subject or PR title against the format in `AGENTS.md`, with the scope limited to the area labels. The hook reads the whole first paragraph, as Git does, and skips the subjects Git writes for merges, reverts, reapplies and `fixup!`, `squash!` and `amend!` commits. |
| `vite/public-pages-plugin.ts` | `vite.config.ts`                                 | Vite plugin, kept outside `scripts/`. In `pnpm dev` it serves the static article pages the same way `build-prerender.mjs` renders them, and injects page metadata into `index.html`.                                                                                                    |

## Release checks

These read the build output and fail the build when something is wrong. They never change files.

| Script                     | Runs from                                         | What it checks                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-native-notices.mjs` | `postbuild` (with `--dist`) and the CI deploy job | The installed preview WASM matches the reviewed SHA-256, every licence file matches its recorded hash, and the combined third-party notices include the native bundle. With `--dist` it also checks the built copies. See [NOTICES.md](NOTICES.md).                          |
| `check-public-pages.mjs`   | `postbuild`                                       | For every URL in `sitemap.xml`: one `h1`, canonical and Open Graph URLs, JSON-LD, navigation landmarks, three related links, no dead internal links, and no app JavaScript on static articles. It asserts the exact page count, so adding a page means updating that number. |
| `check-pages-assets.mjs`   | `deploy:check` and the CI `check` job             | `dist/` is safe to upload to Cloudflare Pages: no symlinks, hidden files or server-side entry points, no file over 25 MiB, no more than 20,000 files, and a `wrangler.jsonc` that uploads only `dist/`. See [HOSTING.md](HOSTING.md).                                        |

## Fixtures

`scripts/fixtures/` builds the project-owned PDFs. No third-party documents, fonts or images go in.

| Script                            | Use                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdf-fixtures.mjs`                | Builders for the starter PDFs and the test fixtures. Imported by most unit tests and the e2e tests.                                                                       |
| `action-fixtures.mjs`             | Builds a PDF with an action from every source the Actions panel reads. Imported by `tests/document-actions.test.ts`, `tests/document-transfer.test.ts` and the e2e tests. |
| `example-fixtures.mjs`            | Builders for the example PDFs on the site. Imported by `generate-samples.mjs` and `tests/example-fixtures.test.ts`.                                                       |
| `generate-samples.mjs`            | Writes the thirteen PDFs in `public/samples/`. Run `node scripts/fixtures/generate-samples.mjs` after changing either builder.                                            |
| `generate-encryption-fixtures.py` | Writes the encrypted test PDFs in `tests/fixtures/encryption/` with pypdf 6.14.2. Run after `generate-samples.mjs`. See that folder's README.                             |
| `generate-example-font.py`        | Rebuilds `scripts/fixtures/assets/example-mark.ttf` with fonttools 4.63.0. The TTF is committed, so normal regeneration needs only Node.                                  |

The Python scripts are rarely needed. Their outputs are committed, so nothing in install, build or test calls them. They exist so the fixtures can be shown to be original and reproduced.

## Corpus

`scripts/corpus/` supports the opt-in real-world test run. See [CORPUS.md](CORPUS.md).

- `manifest.json` pins each PDF to a source commit, SHA-256 and size.
- `fetch-corpus.mjs` (`pnpm run corpus:fetch`) downloads the files into the gitignored `.context/corpus/`. It is the only script that uses the network.
- `vitest.config.ts` (`pnpm run test:corpus`) runs `tests/corpus.spec.ts`, which never downloads anything.
- `probe-document.ts` opens one PDF in an isolated Node process with a time and heap limit, and reports the result to the test.

## Performance

`performance/browser-baseline.mjs` opens corpus PDFs in a production build with headless Chromium and measures time to usable, navigation speed, main-thread stalls and heap use. Run it by hand with `node scripts/performance/browser-baseline.mjs`. CI does not run it. See [PERFORMANCE.md](PERFORMANCE.md).
