# Third-party software

QudadFlow Translator bundles these reader dependencies locally. The browser extension does not download executable code at runtime.

* PDF.js / pdfjs-dist 6.4.299 — Mozilla and PDF.js contributors. Apache License 2.0. See `vendor/pdfjs/LICENSE`, plus the notices in `vendor/pdfjs/cmaps`, `vendor/pdfjs/standard_fonts`, and `vendor/pdfjs/wasm`. Source: https://github.com/mozilla/pdf.js
* fflate 0.8.3 — Arjun Barrett. MIT License. See `vendor/fflate/LICENSE`. Source: https://github.com/101arrowz/fflate
* docx-preview 0.4.1 — docx-preview contributors. Apache License 2.0. See `vendor/docx-preview/LICENSE`. Source: https://github.com/VolodymyrBaydalka/docxjs
* JSZip 3.10.2 — Stuart Knightley, David Duponchel, Franz Buchinger, and António Afonso. Used under the MIT license (also offered under GPLv3). See `vendor/jszip/LICENSE`. Source: https://github.com/Stuk/jszip

The distribution files used by the reader are checked into `vendor/`. `vendor/dependencies.json` records the exact upstream archive versions, integrity values, included paths and local patches. To reproduce them, run `node tools/vendor-document-libs.mjs` (requires network access and tar). Upstream archive integrity is verified before the documented patch is applied. PDF JavaScript, external document links, and embedded attachments are not executed by this reader.

PDF.js local modification (QudadFlow 0.9.9, 2026-11-10): in both `vendor/pdfjs/legacy/build/pdf.mjs` and `vendor/pdfjs/legacy/build/pdf.worker.mjs`, the bundled core-js `internals/object-create.js` legacy IE iframe fallback now uses the explicit literal `var javascriptProtocol = 'javascript:';` followed by `iframe.src = javascriptProtocol;`. This replaces the upstream assembled protocol string and abbreviated variable with a readable equivalent. It does not change the URL value or fallback behavior. The vendoring script applies `tools/pdfjs-readability.mjs` after extraction and rejects unexpected upstream changes. Package validation requires the readable form in both modules. Original license headers and licenses are retained. The reader does not execute PDF JavaScript and keeps `isEvalSupported: false` and `enableXfa: false`; its extension content security policy is unchanged.

The separate, optional Windows x64 ChatGPT companion release bundles the official Node.js v24.18.0 `node.exe` and its complete distribution license as `NODE_LICENSE.txt`. Its source ZIP SHA256 is verified against Node.js's published `SHASUMS256.txt` before packaging. The companion is installed only after the user downloads and runs its installer; it is not in the browser extension package.
