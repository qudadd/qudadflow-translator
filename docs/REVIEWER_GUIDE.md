# QudadFlow Translator: certification review

The extension has no QudadFlow account or login. Production translation calls a user-configured third-party API directly. Valid provider credentials are needed for live Google Cloud Translation, DeepL, Microsoft Translator, or OpenAI-compatible services. No shared production keys are supplied.

For the 0.5.0 submission and 0.6.0 preview, Settings includes **启用 MyMemory 基础试用** (enable basic trial). Approve access to api.mymemory.translated.net and try a short English sentence. No key is needed; English → Simplified Chinese is preconfigured. The typical anonymous quota is 5,000 characters/day, with provider retention/usage terms. Source language must be selected manually. This is a public, limited trial, not an unlimited service. Full current review steps and document limitations are in [STORE_UPDATE_0.6.0.md](STORE_UPDATE_0.6.0.md) (prepared for 0.6.0; not yet submitted).

For functional review without a paid account, the source repository includes an optional local simulated API. It demonstrates the custom JSON path with the submitted extension's normal settings and optional host permission flow. It is not a translation engine and does not prove live-provider translation quality. It is not bundled in the runtime extension.

## Local manual review

1. Obtain the source from https://github.com/qudadd/qudadflow-translator . With Node.js 18 or newer installed, run `node tools/review-api.cjs` from the repository root. It binds only to `127.0.0.1:8765`, logs no request content, and sends no external requests. Keep it running during review; stop with Ctrl+C.
2. In the submitted extension's settings, choose **自定义 JSON 接口** (Custom JSON). Set the endpoint to `http://127.0.0.1:8765/translate`. Leave API Key empty and custom headers as `{}`. Set request template to `{"text": {{text}}}` and response path to `data.translation`.
3. Click **保存设置** (Save) and allow access to the local API domain. Click **测试连接** (Test connection); a successful result confirms the request completed.
4. Open `http://127.0.0.1:8765/`. Select **Hello world** and use the extension or context menu: the fixture returns **你好，世界**. **Good morning** becomes **早上好** and **Read more** becomes **了解更多**. Other text is echoed. Page and immersive translation preserve the extension's paragraph markers through this deterministic substitution.
5. Test webpage translation, immersive bilingual insertion, copy, and restore from the extension popup. Stop the local API and retry a translation to inspect the failure message.
6. For live-provider review, choose the appropriate provider and supply valid credentials from that provider. Save and approve that API domain before testing. Changing provider maintains separate configuration drafts.

The current interface is Simplified Chinese. English and Simplified Chinese extension metadata and store listings are included. Page text is read only after a user action; API responses are rendered as text, never executed. The runtime contains no remotely hosted JavaScript. Browser internal/protected pages do not permit translation-script injection.

## Document and configuration review (0.6.0 preview)

1. Open **PDF / 文档左右对照** and choose a local text-based PDF, DOCX, TXT or Markdown. Opening sends no translation request. The default **沉浸原位** mode replaces text within the original page regions. Test **查看原文**, **原版左右对照** and **段落对照**. Oversized translations preserve the original and offer full text on click. Word uses browser rendering; fonts/complex layout can differ.
2. With a traditional API or AI configured, translate the current page/all pages. Check ratios, picture/table positions, streaming, synchronization, stop/resume and bilingual TXT export. Scanned-page OCR replacement and layout-preserving document export are not included.
3. Save a named OpenAI-compatible profile for a model/gateway that supports image input. Keep a traditional connection active for body translation. Expand **AI 图文工作流**, extract PDF/Word pictures or crop a PDF chart. No API call occurs during extraction. Choose the saved vision profile and explicitly click **翻译图文并解释**. Check streamed text, download/remove, cancellation, and unsupported-model errors. No shared vision API key is provided.
4. Verify saved profile editing and popup switching. Keys stay in browser-local extension storage. Limits: 25 MB/document, 300 pages/reading sections, one million text characters; 20 extracted images/24 MB, 4 MB encoded per image, longest edge 1,600 pixels.

151 isolated checks passed: 87 webpage/provider, 34 document, 13 configuration, 17 layout/figure. Use node tools/layout-check.cjs for generated PDF/Word fixtures and simulated vision responses. Automated tests do not access private settings or call paid/live providers. The local manual review server above supports text simulation only. The preview has not been submitted; 0.5.0 was last confirmed In review. See [VERIFICATION.md](VERIFICATION.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).
