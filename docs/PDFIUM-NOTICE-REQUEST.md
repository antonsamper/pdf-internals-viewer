# Draft request for build-matched native notices

This is an unsent historical draft. The project reconstructed and reviewed a conservative exact-source/toolchain notice inventory; see [NOTICES.md](NOTICES.md). Keep this request for a future supplier-issued bundle. It is no longer a launch prerequisite.

## Artifact

- Package: `@embedpdf/engine-runtime-wasm32@3.1.0`, used through `@embedpdf/engine@3.1.0`.
- Binary: `lib/embedpdf.wasm`.
- Size: 7,880,343 bytes.
- SHA-256: `7195838021c8318416117611b961614ab52eedcad585db5945681f86164e40f9`.

## Suggested message

We are preparing a public, browser-based PDF inspection application using EmbedPDF's local 3.1.0 engine. We want to distribute the correct third-party notices with the exact WebAssembly artifact above.

We traced the binary to your public finished runtime payload `runtime-payloads-d7fb709a6427d8d9`. The viewer v3.1.0 manifest pins runtime fork `aa59ce554aab55879b728dbb86714e13e5cb327f`, based on PDFium `6688c576fd851f4159c6fae39396da50939de110`. Its wasm32 static-library archive matches SHA-256 `0a4c947c05ae314414fb772d0fdf20a6ffbdc412194ba6ed3c49abd42170eb5c`, and the finished payload's WASM is byte-identical to the npm binary above.

We have preserved the archive's `LICENSES/PDFIUM_LICENSE` and both matching CloudPDF NOTICE files. The archive contains `args.gn` and build metadata, so we no longer need the PDFium revision or configuration identified. We still need the complete third-party native notice bundle: the archive only contains that top-level license, and the finished payload contains JS/WASM files without a separate notice bundle.

Could you point us to:

1. The complete license and attribution texts for the native third-party components included in this wasm32 build, including applicable linked Emscripten 3.1.72 runtime notices.
2. Any additional attribution/distribution instructions for this artifact, and where the matching notice bundle will be published for future package versions.

Please tie the native notice bundle to these verified build IDs. We are keeping the application source MIT licensed while preserving the licenses and notices applicable to dependencies.

Thank you.

## Tracking

Record the supplier response and exact source/build references in `docs/NOTICES.md`. Verify that the supplied notice bundle matches this binary before replacing the current draft status. This draft is not evidence that the missing notice coverage has been resolved.
