# Chrome code readability correction: 0.9.9

Product: QudadFlow Translator (`dfecnbleolbeddoflpfmailolehhnaih`). Review reference: **Red Titanium**. The developer received a rejection identifying an assembled JavaScript URL scheme in the bundled PDF.js worker.

## Source and correction

The code comes from `core-js/internals/object-create.js`, included in the readable legacy distribution of `pdfjs-dist` **6.4.299**. It provides an old IE iframe fallback when native `Object.create` is absent. The same fallback occurs in both bundled modules:

- `vendor/pdfjs/legacy/build/pdf.mjs`
- `vendor/pdfjs/legacy/build/pdf.worker.mjs`

Both copies now state the value directly:

```js
// QudadFlow local modification: spell out the protocol in this core-js
// legacy IE fallback. See THIRD_PARTY_NOTICES.md for patch provenance.
var javascriptProtocol = 'javascript:';
// Existing iframe initialization remains here.
iframe.src = javascriptProtocol;
```

This replaces the assembled protocol and abbreviated `JS` variable. The URL string and fallback behavior are identical. Supported Chromium versions have native `Object.create`; the correction does not introduce PDF scripting or a new execution path. PDF.js remains the same pinned version, with all other distribution bytes retained. Original licenses and headers are preserved; modified lines are marked in each module and explained in `THIRD_PARTY_NOTICES.md`.

## Reproduction and regression checks

`node tools/vendor-document-libs.mjs` downloads the pinned archives, checks their SHA512 integrity, then applies `tools/pdfjs-readability.mjs`. `vendor/dependencies.json` records the local patch separately from upstream archive integrity. The patch refuses unexpected upstream changes. Package validation checks both modules, including the staged installable extension. Build tests restore the upstream expression in each module and require validation/packaging to reject it while preserving existing output artifacts.

The extension bundles executable dependencies locally. Its CSP remains `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. The reader keeps `isEvalSupported: false` and `enableXfa: false` and does not execute PDF JavaScript. Website scopes, document processing and optional AI requests follow the existing permission model.

## Reviewer steps

1. Inspect the two modules and the local patch/provenance above.
2. Open the extension document reader and select a local PDF. Rendering, text extraction, page navigation and ordinary figure/table extraction need no account or API key.
3. Optional translation and paper questions use a reviewer-configured service/model. No shared production credential is supplied.

See [release notes](RELEASE_NOTES_0.9.9.md), [verification](VERIFICATION_0.9.9.md) and [actual publication status](STORE_SUBMISSION_0.9.9.md). This correction addresses the reported code; only the store can determine review approval.
