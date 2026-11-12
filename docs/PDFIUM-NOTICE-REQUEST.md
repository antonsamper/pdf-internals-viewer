# Draft request for build-matched native notices

Draft only. Nothing has been sent or posted.

## Artifact

- Package: `@embedpdf/engine-runtime-wasm32@3.1.0`, used through `@embedpdf/engine@3.1.0`.
- Binary: `lib/embedpdf.wasm`.
- Size: 7,880,343 bytes.
- SHA-256: `7195838021c8318416117611b961614ab52eedcad585db5945681f86164e40f9`.

## Suggested message

We are preparing a public, browser-based PDF inspection application using EmbedPDF's local 3.1.0 engine. We want to distribute the correct third-party notices with the exact WebAssembly artifact above.

The installed runtime-wasm32 package includes an Apache 2.0 license, but we have not found a build-matched PDFium/native third-party notice bundle or an exact PDFium revision/build manifest. The core-fonts package has its own PDFium notice, which we are preserving for those fonts; we have not assumed it covers the entire WASM runtime.

Could you point us to:

1. The exact source/PDFium revision and build configuration used for this artifact.
2. The complete third-party license and notice bundle corresponding to the native dependencies actually compiled into it.
3. Any additional attribution/distribution instructions for this build, and where the matching notice bundle will be published for future package versions.

A link to a versioned source/build manifest and its generated notices would be ideal. We are keeping the application source MIT licensed while preserving the licenses and notices applicable to dependencies.

Thank you.

## Tracking

Record the supplier response and exact source/build references in `docs/NOTICES.md`. Verify that the supplied notice bundle matches this binary before replacing the current draft status. This draft is not evidence that the missing notice coverage has been resolved.
