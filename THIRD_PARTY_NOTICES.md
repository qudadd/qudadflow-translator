# Third-party software

QudadFlow Translator bundles these reader dependencies locally. The browser extension does not download executable code at runtime.

* PDF.js / pdfjs-dist 6.4.299 — Mozilla and PDF.js contributors. Apache License 2.0. See `vendor/pdfjs/LICENSE`, plus the notices in `vendor/pdfjs/cmaps`, `vendor/pdfjs/standard_fonts`, and `vendor/pdfjs/wasm`. Source: https://github.com/mozilla/pdf.js
* fflate 0.8.3 — Arjun Barrett. MIT License. See `vendor/fflate/LICENSE`. Source: https://github.com/101arrowz/fflate
* docx-preview 0.4.1 — docx-preview contributors. Apache License 2.0. See `vendor/docx-preview/LICENSE`. Source: https://github.com/VolodymyrBaydalka/docxjs
* JSZip 3.10.2 — Stuart Knightley, David Duponchel, Franz Buchinger, and António Afonso. Used under the MIT license (also offered under GPLv3). See `vendor/jszip/LICENSE`. Source: https://github.com/Stuk/jszip

The unmodified distribution files used by the reader are checked into `vendor/`. `vendor/dependencies.json` records the exact archive versions, integrity values, and included paths. To reproduce them, run `node tools/vendor-document-libs.mjs` (requires network access and tar). PDF JavaScript, external document links, and embedded attachments are not executed by this reader.

The separate, optional Windows x64 ChatGPT companion release bundles the official Node.js v24.18.0 `node.exe` and its complete distribution license as `NODE_LICENSE.txt`. Its source ZIP SHA256 is verified against Node.js's published `SHASUMS256.txt` before packaging. The companion is installed only after the user downloads and runs its installer; it is not in the browser extension package.
