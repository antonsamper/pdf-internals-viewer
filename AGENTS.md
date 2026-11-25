# AGENTS.md

PDF Internals Viewer is a static Vite/React app for inspecting the structure of PDF files in the browser.

## Product rules

- PDFs are read-only. Never modify or rewrite the input file.
- Files are processed in the browser. No network request may contain document content.
- Show original bytes only when an exact source range exists. Label decoded or reconstructed values as such.
- Show parse failures and unsupported features. Partial results stay usable.

## Workflow

- Every change starts with a GitHub issue created from a template. Titles are plain imperative sentences ("Add page-text search"). Bug titles describe the symptom.
- Keep issue bodies short: context, a one-line description and acceptance criteria. Don't list files, renames or implementation steps. The PR diff shows those.
- Each issue gets one type label (`feature`, `bug`, `chore`, `docs`, `ci`, `test`, `perf`, `epic`) and at least one area label (`inspector`, `site`, `search`, `infra`, `brand`).
- Work that needs 3 or more PRs gets a parent issue labelled `epic`, with each ticket as a sub-issue. Close the epic when its goal is met. Later work in the same area gets a new epic or a standalone issue.
- Branch: `PIV-<issue>`, for example `PIV-34`.
- Commit subjects and PR titles: `[PIV-<issue>] type(scope): summary`, for example `[PIV-34] feat(search): add page-text search`. Types: `feat`, `fix`, `chore`, `docs`, `ci`, `test`, `perf`, `refactor`. The scope is an area label; leave it out when none fits. The summary is all lowercase, including names and acronyms (`pdf`, `eslint`), imperative, with no full stop. 72 characters at most.
- Fill in the PR template. `Closes #<issue>` must match the number in the title. Description bullets are 72 characters at most. Add screenshots for UI changes.
- Description bullets say what changed and why, in terms of behaviour. Don't list files, tests or test results: the diff shows the files and CI reports the results. Mention a test only when it is the point of the PR (a `test` PR), and say what it covers, not its filename or whether it passed.
- Before opening a PR, run gstack `/review` and `/verify`. Don't use `/ship` or `/document-release`.
- Before merging, tick each acceptance criterion on the issue that the PR meets. If one isn't met, meet it or raise a separate ticket for it and link that ticket on the issue.
- PRs are squash-merged into `main`.

## Styling

- Style with Tailwind utilities, shadcn variants and the theme tokens. Follow `DESIGN.md` for the rules.
- Class constants are for lists that several elements share. Lists up to about 100 characters stay one string; longer ones use `cn()` with a string per group (positioning, layout, sizing, spacing, typography, appearance, borders and effects, interaction, component states, responsive, dark mode, animation, overrides). `DESIGN.md` has the details and an example.

## Docs

- Docs and code comments describe the current state. History belongs in git, issues and PRs.
- Update the repo docs and the user-facing site content (guides, examples, limitations) in the same PR as the code change.
- Follow `DESIGN.md` for UI work, and update it when the design changes.

## Deployment

Merging to `main` deploys to production through GitHub Actions. Never deploy manually.
