# EmbedPDF validation backport

EmbedPDF 3.1.0 depends on Zod 3.25.76, which is affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): an oversized array or Set is validated element by element before its size limit is checked. No Zod 3 release fixes it, and forcing Zod 4 would break APIs the engine uses.

`scripts/prepare-preview.mjs` backports the [upstream fix](https://github.com/colinhacks/zod/commit/a0ebf97) locally. Arrays and Sets with a maximum size now fail on size before any element is visited. Everything else behaves as upstream.

## What gets patched

EmbedPDF ships precompiled worker bundles with their own copy of Zod, so patching the installed Zod package is not enough. The script patches both installed Zod module formats and every bundled copy inside `@embedpdf/engine`, including the worker held as an escaped string.

It is strict by design:

- it requires `@embedpdf/engine` 3.1.0 and Zod 3.25.76 exactly;
- every file has a recorded original and patched SHA-256, and unknown bytes stop the install;
- running it again changes nothing;
- it is the only step that modifies installed dependency files. pnpm copies those files instead of linking them, so the shared store is never changed.

Upgrading EmbedPDF or Zod means re-pinning these hashes, after checking whether upstream has shipped a fix.

## Modification notices

Every patched file, and every decoded worker string, starts with a `/*! Modified by PDF Internals Viewer: ... */` notice. `vite.config.ts` keeps legal comments during minification, and the `postbuild` check `scripts/check-preview-notices.mjs` confirms the built assets still carry the notice. Third-party licence texts are covered in [NOTICES.md](NOTICES.md).

## Tests

`tests/preview-validation.test.ts` runs array and Set cases against both Zod module formats and every bundled copy, using each bundle's own code in an isolated VM. It also checks that removing the patch restores the original file hash. After changing the preparation script, run the production build and the browser preview tests too.

## Scope

The patch only enforces size limits that a schema already declares. It does not add limits to unbounded schemas or replace the app's own file, decoding and timeout limits.

## Advisory status

`pnpm audit` works from package versions, and the installed package is still Zod 3.25.76, so it reports the advisory. The project does not suppress it or alter the declared version. Replace the backport with a compatible upstream EmbedPDF or Zod update as soon as one exists and its behaviour tests pass.
