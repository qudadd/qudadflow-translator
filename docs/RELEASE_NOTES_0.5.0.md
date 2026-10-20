# QudadFlow Translator 0.5.0

This release adds side-by-side reading for PDF, DOCX, TXT, and Markdown, persistent API configuration profiles, and an optional key-free MyMemory basic trial.

- Open a PDF's URL from the extension popup or a page/link context menu, or choose/drop a local file. PDF shows the original rendered page and selectable text alongside translated paragraphs. Word/text use aligned reading paragraphs. Translate the current page or entire document, synchronize scrolling, stop/resume, and export bilingual TXT.
- Save up to 20 named configurations, edit or duplicate them, delete unused schemes, and switch from the popup. Existing settings are preserved on first use. Keys remain in browser-local storage; no configuration is uploaded to this repository.
- Enable the MyMemory basic trial in Settings without a key. The default is English → Simplified Chinese; source language must be chosen manually. Typical anonymous quota: 5,000 characters/day. It is intended for non-private short samples; provider retention and usage terms apply. It is not an unlimited translation service.
- Includes previous immersive-layout, nearby selection, streaming, caching, viewport priority, cancellation, and concurrency improvements.

Document limits: 25 MB, 300 pages/reading sections, one million extracted characters. Scanned-image OCR is not included. DOCX body/table-cell text is extracted without Word images, table layout, headers, footers, or original pagination. Complex PDF reading order and unusual fonts can need checking. Bilingual export is TXT, not a layout-preserving translated PDF/DOCX.

The runtime bundles PDF.js 6.4.299 and fflate 0.8.3, along with their licenses. All executable resources are local. Requires Chromium-based Edge 125+. Updating an unpacked installation requires an extension reload.

Validation uses isolated Edge 155, synthetic credentials, generated documents, and local HTTP fixtures. A separate live MyMemory check sent only the fixed public sentence “Hello world. This is a translation test.” and received Chinese output in about 1.9 seconds; this does not establish sustained availability, quota, quality, or long-document performance. User-configured paid/private API credentials remain untested.

Version 0.5.0 was submitted to Edge Add-ons on October 21, 2026 (Asia/Shanghai); Partner Center confirmed **In review**. The earlier 0.4.2 pending submission was cancelled so this update could be submitted. Its archived ZIP is retained for rollback/audit. Store approval and publication remain pending. See [submission evidence](STORE_SUBMISSION_0.5.0.md).
