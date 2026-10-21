# QudadFlow Translator

A Manifest V3 extension for Microsoft Edge, with immersive bilingual webpages, selection translation, and in-place document translation for PDF, Word DOCX, TXT, and Markdown. Traditional translation APIs and AI both power the base reading features. Vision AI adds an optional picture/chart workflow at the bottom.

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

## Immersive documents

Open **PDF / 文档左右对照** from the popup or the document command in the page/link context menu. Open the prefilled HTTP(S) document URL after granting its source host, or choose/drop a local file. Download authenticated or blob documents first if the reader cannot fetch them. Opening a document sends no translation request.

- **沉浸原位 — In-place immersive:** PDF preserves the original page ratio and keeps images/vector charts in position. Translated text replaces the source text region. Long or unsupported text retains its original and a clickable full-translation link; nothing pushes later content down. Click a translation to inspect its original. **查看原文** toggles the source page.
- **原版左右对照 — Original-layout comparison:** original and translated pages appear side by side at the same scale. **段落对照 — Paragraph comparison:** reflows text for comfortable reading and height-aligns corresponding paragraphs.
- Word DOCX renders pages, tables, embedded raster images, margins and text locally. Translation overlays stay in the measured paragraph regions. Browser fonts and complex Word layouts can differ from Microsoft Word; use a PDF when strict layout fidelity is needed. TXT and literal Markdown retain their reading-paragraph positions in immersive mode, not original file pagination.
- Translate the current page or all pages with **either traditional MT or AI**. Two requests at most per reader, streaming when supported, stop/resume and bilingual TXT export are available. Export does not generate a layout-preserving translated PDF or DOCX.

### Optional bottom AI picture/chart workflow

1. Save an OpenAI-compatible configuration with a model and gateway that support image input. The body can continue using Google, DeepL, Microsoft, MyMemory or another configured text API.
2. Expand **AI 图文工作流** at the bottom. **提取本页图片** extracts PDF raster regions or Word images locally. For PDF vector charts use **框选图表**, or **提取整页** for a whole-page image. Preview, download or remove the extracted images.
3. Choose the current AI connection or a separately saved AI profile. Click **翻译图文并解释**, or analyze the unfinished images. Only this click sends the selected image(s), target language and analysis instructions to that AI endpoint. Results stream as text; stop at any time. Image analysis does not rewrite chart artwork or replace scanned-page text.

Images are bounded to a 1,600-pixel longest edge, 4 MB encoded per image, and 20 images/24 MB total. Document images stay in tab memory and bypass the text cache. Analysis results may be retained when optional research memory is enabled. Downloaded images and exported TXT persist in your chosen folder. Opening/extracting pictures does not call AI. Check AI transcriptions and numerical explanations against the original.

Files are limited to 25 MB, 300 pages/reading sections and one million extracted characters. Text must be UTF-8 or BOM-tagged UTF-16. Old .doc, spreadsheets and presentations are unsupported. Scanned PDFs need external OCR for body replacement; the optional vision workflow can inspect a page image. Complex columns, overlapping text, equations, unusual encodings and special fonts can require the paragraph mode or manual checking.

PDF.js, fflate, docx-preview and JSZip are bundled locally, with no CDN or remote executable code. The browser parses files locally. Body translation sends extracted text; optional figure analysis sends chosen images. Original PDF/DOCX file bytes and passwords are never sent to translation APIs. Requires Chromium-based Edge 125+; checks run on Edge 155. See [third-party notices](THIRD_PARTY_NOTICES.md).

For OpenAI-compatible services, enter a full `/v1/chat/completions` or `/v1/responses` endpoint and a model supported by that service. A domain or `/v1` base URL defaults to Chat Completions. Streaming is enabled by default; turn it off if your gateway does not support it. Leave Temperature empty to use the provider default. A rejected temperature parameter is removed for one retry only. The request timeout defaults to 45 seconds and can be set to 10–180 seconds.

Version 0.4.4 streams immersive text into its paragraph while the response arrives, prioritizes blocks near the viewport, and uses a compact progress panel. Nested text, links, lists, and ordinary grid/flex cards retain their source containers. Bilingual text increases paragraph height; fixed-height layouts, virtualized pages, embedded frames, and shadow-root content can still need site-specific adaptation. An action processes up to 80 blocks from a bounded scan of the main article. Scroll and run it again for another part of a long page; doing so replaces the previous inline translation.

The selection card follows its selected passage while scrolling or resizing. Its request gets the next free slot ahead of queued page work, with a shared limit of two active requests per page. Closing the card cancels only its own request, so immersive translation can continue. Duplicate in-flight commands are suppressed, and completed translations remain visible if a later page batch fails.

Successful repeated translations can be reused from a bounded memory cache for five minutes, avoiding another API call. Configuration changes and worker shutdown clear the cache; connection tests always reach the provider. Actual provider latency and quality still depend on the configured API and model. After updating an unpacked installation, reload the extension and refresh the webpage; browser-local settings are retained.

## Paper research, Skills and optional memory (0.7.0)

Click **论文分析 / 提取网页图表** on a normal paper webpage to open editable article text, captions and figure candidates. Extraction is local and heuristic. Visible SVG/canvas charts may be cropped from a temporary viewport screenshot. Remote/offscreen images offer a separate load action with source-domain permission. Check the candidates before analysis; embedded frames, protected images and complex publisher pages can need manual selection or the PDF reader.

PDF, DOCX, TXT and Markdown share these controls under **AI 图文工作流 → 论文分析**: choose current page or full-document material (maximum 60,000 characters), an AI configuration, a Skill and an optional question. Results stream and export as Markdown. Figure requests include captions and up to 8,000 characters from their extraction page; original page attribution is preserved after navigation.

Three built-in Skills cover close reading, methods/statistics and chart interpretation. Settings supports copying/editing and JSON/Markdown/TXT import/export, with up to 20 custom templates of 4,000 characters. Skills are plain prompt templates, not executable scripts.

Memory is **off by default**. Opt in and choose a notebook; ordinary translation stays stateless. Each analysis selects at most six relevant records from that notebook, within a 4,000/6,000/12,000-character budget (6,000 default). IndexedDB stores individual deduplicated records, globally capped at 300 records / two million content characters, evicting oldest records. Each record keeps up to 2,000 source characters and 10,000 analysis characters plus source metadata. Choose 7/30/90-day retention (90 default), or capacity-only retention. Expiry is cleaned on subsequent research access. Disable memory to stop future use/saving; existing records remain until deleted or expired. Settings provides search, deletion, clearing and all-notebook JSON/Markdown export. Exports exclude extension API configurations and image bytes, but include saved research text.

After chart recognition, click **生成 Python** or **生成 R** to download a .py/.R draft and Markdown notes. Prompts require attributable data or user-provided data.csv, mark estimated values and prohibit invented sample data. The extension never executes generated code. Independently verify code, dependencies, data and methods; a picture cannot guarantee exact scientific reproduction.

Web captures use a separate local cache: up to four captures, 16 MB image bytes each, one-hour expiry with lazy cleanup. Local document images stay in tab memory. Analysis sends chosen material, source title/page and URL origin/path, selected Skill/question and enabled notebook context directly to your chosen AI. See the privacy policy for retention and deletion details.

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
node tools/layout-check.cjs layout-results.json
node tools/research-check.cjs research-results.json
```

Version 0.7.0 passed 169 checks with zero failures and covers webpage/provider behavior, documents, saved configurations, original-position replacements and the optional vision workflow. Suites use generated documents, synthetic keys, local HTTP fixtures and isolated Edge profiles. No private provider settings or live API credentials are accessed. These checks verify behavior, not real-provider speed, availability or translation quality. See [verification details](docs/VERIFICATION.md).

## Publishing

Version 0.5.0 is Live in Edge Add-ons, confirmed in Partner Center on October 21, 2026. Version 0.7.0 is the current release update; see the [submission record](docs/STORE_SUBMISSION_0.7.0.md) for its verified official status and [release notes](docs/RELEASE_NOTES_0.7.0.md).
