# Page preview

EmbedPDF Engine 3.1.0 renders a small, read-only page preview. The app supplies its own React controls using shadcn/ui and Base UI, without embedding a second full viewer interface.

## Integration

`src/components/pdf-preview.tsx` exports `PdfPreview` with these props:

- `bytes: Uint8Array`: immutable original input; the component supplies a copy to the engine so worker transfers cannot detach the inspector's buffer.
- `fileName: string`: used for accessible image descriptions.
- `pageNumber?: number`: optional controlled, one-based page selection.
- `onPageChange?: (pageNumber: number) => void`: navigation callback.

The preview opens the document locally, lists pages, and renders the selected page into a bounded-resolution image. Its controls support previous/next page and zoom from 50% to 200%. Raster previews do not implement text selection, annotations, editing, or rendered-content-to-object mapping.

Document replacement and component unmount abort outstanding work, revoke rendered blob URLs, close the document, and destroy the engine worker. Loading and rendering failures are shown without changing the independent structure inspector.

## Runtime assets and privacy

The dependency's PDFium engine is compiled to WebAssembly and runs in a Web Worker. Vite bundles the engine's worker and WebAssembly from installed packages, serving them from the application itself. The component opens a copied byte buffer; no PDF upload or cloud engine is used. Default fallback fonts also come from dependency assets. They do not require remote document-dependent font URLs.

The parser remains separate. Rendering a page does not establish exact original object/stream spans. Preview output is never substituted for original bytes.

## Documentation checked

- [EmbedPDF engine quick start](https://www.embedpdf.com/docs/engine/quick-start)
- [Engine setup and self-hosted bundler assets](https://www.embedpdf.com/docs/engine/setup)
- Actual npm package `@embedpdf/engine@3.1.0` and its TypeScript declarations. Version 2 documentation refers to different package names and is not used for this implementation.

## Verification

The consuming application should include preview opening/navigation in its browser smoke test and confirm worker/WASM requests remain same-origin. Type checking and production bundling are required integration checks. Browser behavior requires a test run; the integration notes alone do not verify it.
