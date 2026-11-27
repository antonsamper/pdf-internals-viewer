# Page preview

`src/components/pdf-preview.tsx` renders a small, read-only page preview with EmbedPDF Engine 3.4.0, using the app's own controls: previous and next page, and zoom from 50% to 200%. The preview is an image, so it does not support text selection, annotation editing or picking rendered content to find its PDF object.

## Privacy

The engine is PDFium compiled to WebAssembly and runs in a Web Worker. Vite bundles the worker, the WASM and the fallback fonts, and the app serves them from its own origin. The preview opens a copy of the file's bytes; nothing is uploaded and no document-dependent URL is requested.

## Separate from inspection

The inspector uses its own parser ([PARSER.md](PARSER.md)). A rendered page says nothing about exact object or stream spans, and preview output is never shown in place of the original bytes. Preview errors do not affect the inspector.

Page text search highlights come from the engine's text geometry, drawn as an SVG overlay that follows zoom, rotation and pane size. They work even when the inspector cannot map a match to source bytes, and they never change the PDF. Replacing the document or closing the preview cancels outstanding work and destroys the engine worker.

## Tests

The browser tests in `tests/e2e.spec.ts` check that the preview renders without external requests or runtime errors, that search highlights follow rotation, zoom and page navigation, and that an encrypted file previews after it is unlocked.
