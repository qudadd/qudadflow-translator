# QudadFlow Translator: certification review

The extension has no QudadFlow account or login. Production translation calls a user-configured third-party API directly. Valid provider credentials are needed for live Google Cloud Translation, DeepL, Microsoft Translator, or OpenAI-compatible services. No shared production keys are supplied.

For the 0.5.0 update, Settings includes **启用 MyMemory 基础试用** (enable basic trial). Approve access to api.mymemory.translated.net and try a short English sentence. No key is needed; English → Simplified Chinese is preconfigured. The typical anonymous quota is 5,000 characters/day, with provider retention/usage terms. Source language must be selected manually. This is a public, limited trial, not an unlimited service. Full current review steps and document limitations are in [STORE_UPDATE_0.5.0.md](STORE_UPDATE_0.5.0.md).

For functional review without a paid account, the source repository includes an optional local simulated API. It demonstrates the custom JSON path with the submitted extension's normal settings and optional host permission flow. It is not a translation engine and does not prove live-provider translation quality. It is not bundled in the runtime extension.

## Local manual review

1. Obtain the source from https://github.com/qudadd/qudadflow-translator . With Node.js 18 or newer installed, run `node tools/review-api.cjs` from the repository root. It binds only to `127.0.0.1:8765`, logs no request content, and sends no external requests. Keep it running during review; stop with Ctrl+C.
2. In the submitted extension's settings, choose **自定义 JSON 接口** (Custom JSON). Set the endpoint to `http://127.0.0.1:8765/translate`. Leave API Key empty and custom headers as `{}`. Set request template to `{"text": {{text}}}` and response path to `data.translation`.
3. Click **保存设置** (Save) and allow access to the local API domain. Click **测试连接** (Test connection); a successful result confirms the request completed.
4. Open `http://127.0.0.1:8765/`. Select **Hello world** and use the extension or context menu: the fixture returns **你好，世界**. **Good morning** becomes **早上好** and **Read more** becomes **了解更多**. Other text is echoed. Page and immersive translation preserve the extension's paragraph markers through this deterministic substitution.
5. Test webpage translation, immersive bilingual insertion, copy, and restore from the extension popup. Stop the local API and retry a translation to inspect the failure message.
6. For live-provider review, choose the appropriate provider and supply valid credentials from that provider. Save and approve that API domain before testing. Changing provider maintains separate configuration drafts.

The current interface is Simplified Chinese. English and Simplified Chinese extension metadata and store listings are included. Page text is read only after a user action; API responses are rendered as text, never executed. The runtime contains no remotely hosted JavaScript. Browser internal/protected pages do not permit translation-script injection.

## Document and configuration review (0.5.0)

1. Open **PDF / 文档左右对照** from the popup. Choose **打开文件** and select a text-based PDF, DOCX, TXT, or Markdown file. Opening a local file alone sends no translation request. For a PDF already open on a website, the reader can prefill its URL; **打开文档** requests the source site's optional permission before downloading.
2. Use **翻译当前页** (current page) or **翻译全文** (all). PDF retains its original rendered page and selectable text on the left; the right side shows that page's ordered translated paragraphs. DOCX and text use aligned reading paragraphs. Check page navigation, **同步滚动**, **停止翻译**, resuming, and **导出双语 TXT**. To keep the public MyMemory trial within quota, use a few short English paragraphs.
3. In Settings, name the connection and use **另存为新方案并使用** to preserve a second configuration. Select an existing scheme, edit it, and click **保存设置** to apply. Verify switching from the popup. Up to 20 schemes, including their keys, stay in browser-local storage.

Limits are 25 MB, 300 pages/reading sections, and one million extracted characters. Scanned-image OCR is not included. DOCX extracts body and table-cell text without reproducing images, table layout, headers/footers, or Word pagination. Export is bilingual TXT. Complex PDF ordering can require checking. PDF.js and its WASM codecs are bundled locally; there is no remote executable code. Minimum Chromium-based Edge version is 125.

Version 0.5.0 passed 134 isolated Edge checks: 87 webpage/provider, 34 document, and 13 saved-configuration/basic-provider checks. The automated suites use generated files, synthetic keys, and local simulated APIs; their results are in [VERIFICATION.md](VERIFICATION.md). A separate anonymous MyMemory fixed-sentence sample returned Chinese in 1,881 ms, which is not a sustained-availability, quality, or performance guarantee. The document store screenshot is explicitly labeled as a simulated-translation demonstration. The manual steps above require neither Playwright nor changes to the production manifest.
