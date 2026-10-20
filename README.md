# QudadFlow Translator

A Manifest V3 extension for Microsoft Edge, with immersive bilingual webpages, selection translation, and a side-by-side document reader for PDF, Word DOCX, TXT, and Markdown. Use your configured translation API throughout.

[Website](https://qudadd.github.io/qudadflow-translator/) · [Privacy policy](https://qudadd.github.io/qudadflow-translator/privacy.html) · [中文网站指南](https://qudadd.github.io/qudadflow-translator/zh-CN.html) · [中文 README](README.zh-CN.md)

## Translation providers

- Google Cloud Translation v2
- DeepL API (Free and Pro endpoints)
- Microsoft Translator (Azure)
- OpenAI-compatible Chat Completions and Responses, including streamed text
- Custom JSON APIs with request templates and response paths
- MyMemory: a key-free basic trial using its documented public GET API, with a typical anonymous allowance of 5,000 characters/day

Bring your own API credentials. Provider accounts, charges, availability, retention policies, and translation quality depend on the provider you choose. The extension does not include a translation subscription or developer-operated proxy. The current extension interface is in Simplified Chinese.

## Saved configurations and basic trial

Settings can keep up to 20 named configurations, including provider, endpoint, key, model, headers, and language preferences, in browser-local storage. An existing configured connection is preserved on first use. Select a saved configuration to edit it, then Save to apply; Save as new retains the previous scheme. The popup can switch between saved schemes. Deleting an active scheme also clears its live connection; other saved schemes retain their own keys. Profile names and metadata are shown in the selector, never keys. This is configuration history, not a record of translated content.

For a quick start, choose **启用 MyMemory 基础试用** in Settings and allow its API domain. No key or account is needed. It starts with English → Simplified Chinese; choose a source language explicitly for other text. MyMemory combines translation-memory matches and machine translation. The extension sends one paragraph per request, splitting at 480 UTF-8 bytes, preserves internal paragraph markers locally, and stops on quota errors. It does not call contribution/upload endpoints or silently switch providers. Requests use HTTPS query parameters, without provider keys or source-site cookies.

The free public service is quota-limited and may retain submitted text long-term; use it for non-private short samples. See [API documentation](https://mymemory.translated.net/doc/spec.php), [usage limits](https://mymemory.translated.net/doc/usagelimits.php), and [terms/privacy](https://mymemory.translated.net/terms-and-conditions). No free unlimited public API is promised. For extensive reading, use your own provider or self-host a compatible translation service.

## Install for development

1. Open `edge://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository folder.
3. Open the extension options, select your provider, enter the endpoint and API key, and save.
4. Allow access to the API domain and use **Test connection**.
5. Open a normal webpage and choose **沉浸式翻译当前网页** (immersive translation).
6. For the nearby selection button, enable **在此网站启用划词翻译按钮** in the popup and approve access to that site. Select text, then click **翻译**. Press Esc to close. This opt-in persists for that site; selecting alone never sends text.

Browser-internal pages and restricted store pages cannot host the webpage translation interface. For a PDF open in Edge, use **PDF / 文档左右对照** in the popup to open the separate document reader. Page-panel extraction is limited to 12,000 characters per action; immersive translation processes up to 80 text blocks.

## Side-by-side documents (0.5.0)

Open **PDF / 文档左右对照** from the popup, or use the document command in the page/link context menu. A current HTTP(S) document URL is prefilled; click **打开文档** and allow access to that document host. For local files, authenticated links that cannot be fetched, or browser blob URLs, download the file and choose **打开文件**, or drag it into the reader. Opening a file does not start a translation request.

- PDF: original rendered page and selectable text on the left; translated paragraphs from that page on the right, with page navigation and proportional synchronized scrolling.
- Word DOCX, TXT, Markdown: extracted text in corresponding, height-aligned paragraph blocks. Reading sections are generated for long text. Word images, headers, footers, tables, and pagination are not reproduced; table-cell body text is extracted in document order. Markdown is displayed as literal text.
- Translate the current page or entire document, see streamed results where the provider supports them, stop and resume incomplete paragraphs, and export bilingual TXT. Up to two translation requests are active per reader; completed paragraphs remain available in the open tab.
- Limits: 25 MB per file, 300 PDF pages/reading sections, and one million extracted characters. Text must be UTF-8 or BOM-tagged UTF-16. Old `.doc`, spreadsheets, presentations, and scanned-image OCR are not supported. Complex PDF layouts, equations, and unusual font encodings may need manual checking; two-column reading order is heuristic. This is a reading view, not a layout-preserving translated PDF/Word exporter.

PDF.js and fflate are bundled locally; no CDN or remote executable code is used. Files are parsed in the browser. Only after a translation action is extracted text sent to the configured API; the original file bytes are not uploaded to that API. The reader uses temporary tab memory. Closing it clears the current document/results; exported TXT files remain wherever you save them. See [third-party notices](THIRD_PARTY_NOTICES.md). Version 0.5.0 requires Chromium-based Edge 125+; automated checks run on Edge 155.

For OpenAI-compatible services, enter a full `/v1/chat/completions` or `/v1/responses` endpoint and a model supported by that service. A domain or `/v1` base URL defaults to Chat Completions. Streaming is enabled by default; turn it off if your gateway does not support it. Leave Temperature empty to use the provider default. A rejected temperature parameter is removed for one retry only. The request timeout defaults to 45 seconds and can be set to 10–180 seconds.

Version 0.4.4 streams immersive text into its paragraph while the response arrives, prioritizes blocks near the viewport, and uses a compact progress panel. Nested text, links, lists, and ordinary grid/flex cards retain their source containers. Bilingual text increases paragraph height; fixed-height layouts, virtualized pages, embedded frames, and shadow-root content can still need site-specific adaptation. An action processes up to 80 blocks from a bounded scan of the main article. Scroll and run it again for another part of a long page; doing so replaces the previous inline translation.

The selection card follows its selected passage while scrolling or resizing. Its request gets the next free slot ahead of queued page work, with a shared limit of two active requests per page. Closing the card cancels only its own request, so immersive translation can continue. Duplicate in-flight commands are suppressed, and completed translations remain visible if a later page batch fails.

Successful repeated translations can be reused from a bounded memory cache for five minutes, avoiding another API call. Configuration changes and worker shutdown clear the cache; connection tests always reach the provider. Actual provider latency and quality still depend on the configured API and model. After updating an unpacked installation, reload the extension and refresh the webpage; browser-local settings are retained.

## Privacy

Translation starts after a user action. Requests go directly to the configured endpoint. Settings and API keys use browser-local extension storage. The extension contains no advertising, analytics, telemetry, or remote executable code. Optional host access is requested separately for your API domain and each site where you enable the selection button. The per-site setting registers bundled UI code for later visits, without automatically translating or sending text. Site matching covers the selected HTTP(S) scheme and host on all ports. Turning the switch off disables the UI and unregisters future loading; revoke retained site access separately through Edge if desired.

The service worker holds recent source text and results only in memory (at most 128 entries / 250,000 characters, five-minute reuse window), never in persistent translation history. See the policy for details.

See the [full privacy policy](https://qudadd.github.io/qudadflow-translator/privacy.html). For support and privacy questions: **lcf1249288484@outlook.com**.

## Build

Requires Node.js and PowerShell. Runtime libraries are checked into `vendor/`; no dependency installation or bundler is needed to package. The integrity-checked dependency download script is `tools/vendor-document-libs.mjs`.

```powershell
.\package.ps1 -OutputDirectory .\dist
```

The script validates the manifest, local scripts, and icons, then creates a runtime ZIP and a separate source ZIP. Upload the runtime ZIP to Edge Add-ons. Never include your API keys in a package or commit.

## Verification

```powershell
npm install --no-save playwright
node tools/functional-check.cjs functional-results.json
node tools/document-check.cjs document-results.json
node tools/configuration-check.cjs configuration-results.json
```

Version 0.5.0 passed 134 checks on Edge 155.0.4283.62: 87 webpage/provider regressions, 34 document checks, and 13 saved-profile/basic-provider checks. They use synthetic credentials, local HTTP fixtures, generated documents, and isolated Edge profiles. Only the test copy receives a localhost permission. The unchanged production manifest also opens and renders a real PDF without host grants. Coverage includes local parsing, page order, streaming, text safety, bounds, aligned paragraphs, synchronized scrolling, stop/resume, port isolation, URL errors, and bilingual export. Live provider credentials, billing, translation quality, and physical keyboard-shortcut activation were not tested. See [verification details](docs/VERIFICATION.md).

## Publishing

Version 0.4.2 was submitted to Edge Add-ons and showed **In review** on October 20, 2026. Version 0.5.0 is a separate development update; it has not replaced that submission. The repository and website do not imply store approval. English and Simplified Chinese metadata keep the same QudadFlow Translator name. The existing 0.4.2 submission materials are in `docs/STORE_LISTING_DRAFT.md`, `docs/STORE_LISTING.zh-CN.md`, and `docs/STORE_SUBMISSION.md`; they do not advertise the new document reader as store-approved.
