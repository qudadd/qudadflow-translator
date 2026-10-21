# Chrome Web Store submission — QudadFlow Translator 0.7.1

Status on October 21, 2026: package/listing preparation; no Chrome item ID, upload or review submission confirmed. The connected browser refuses scripting the extensions gallery. The user's open tab is titled “Chrome 应用商店 - 开发者协议” at the developer registration URL. Developer registration, any required fee and agreement must be completed by the account holder. Do not treat this file as evidence of store submission.

## Upload package and assets

- Runtime: qudadflow-translator-v0.7.1.zip. Use this ZIP, not the separate source ZIP; manifest.json is at its root.
- Title: **QudadFlow Translator** (keep the same English title in every language).
- English summary (under 132 characters): **Immersive webpage and document translation with your own API, selection translation, and optional paper and figure analysis.**
- Category suggestion: Productivity. Interface language: Simplified Chinese; English product/listing text with optional Simplified Chinese listing.
- Store icon: assets/icon128.png. Screenshots: branding/screenshots/ (use the current settings screenshot when available). Existing simulated-translation screenshots are labeled examples and do not demonstrate live-provider quality.
- Homepage: https://qudadd.github.io/qudadflow-translator/
- Support: https://github.com/qudadd/qudadflow-translator/issues
- Support email: lcf1249288484@outlook.com
- Privacy: https://qudadd.github.io/qudadflow-translator/privacy.html
- Chinese privacy: https://qudadd.github.io/qudadflow-translator/privacy.zh-CN.html
- Community: QQ 1048123205; search the number in QQ.

## English description

QudadFlow Translator helps you read webpages and documents in another language using your own translation provider.

• Immersive bilingual webpages, with streamed translation beneath the original paragraph, nearby text priority, and restore-original control.
• Selection translation: enable the site button, select text and click Translate; selecting text alone sends nothing.
• PDF, Word DOCX, TXT and Markdown: in-place reading, original-layout comparison and paired paragraphs. PDF preserves page proportions, images and charts. Text that does not fit retains its original with a full-translation link. Word uses browser rendering and can differ from Microsoft Word.
• Choose Google Cloud Translation, DeepL, Microsoft Translator, OpenAI-compatible Chat Completions/Responses, custom JSON, or an optional quota-limited MyMemory basic trial. Traditional MT and AI both support basic translation.
• Save up to 20 API configurations. Read an OpenAI-compatible upstream model list, search IDs, inspect capabilities only when reported by the provider and explicitly choose a model. Missing data stays unknown. Test the current draft before saving; a short text test does not verify vision support.
• Optional paper tools extract article text, captions and figures locally. Use built-in or custom text Skills to analyze the same reading material, then export Markdown. Figure interpretation requires an image-capable AI model.
• Optional cross-page research memory is off by default. Notebook records are local, bounded, searchable, deletable and exportable. Basic translation does not use research memory.
• After chart recognition, download Python/R drafts and data-requirement notes. Generated code is never executed. Exact reproduction requires original data and independent checks.

Requests start with your action and go directly to the API you configure. No developer proxy, ads, analytics or remote executable code. Files are parsed locally; original PDF/DOCX bytes and passwords are not uploaded to translation APIs. Clicking analysis can send selected images, text, source metadata, Skills and enabled related memory. Model discovery sends credentials to the same-origin models route, without page text. API keys are stored locally in the browser.

Provider accounts, fees, quotas and retention terms apply. The MyMemory trial is not unlimited and may retain submitted text; use non-private short samples. Limits: 25 MB/document, 300 pages/sections, one million extracted characters; paper input up to 60,000 characters. Scanned-body replacement needs external OCR. Export does not create a layout-preserving PDF/DOCX. Interface: Simplified Chinese. Manifest requires Chromium 125+.

QQ community: 1048123205 (search in QQ)
Support: lcf1249288484@outlook.com
Privacy: https://qudadd.github.io/qudadflow-translator/privacy.html

## 中文说明（可选本地化）

名称保持 QudadFlow Translator。中文详细说明使用 [0.7.1 商店文案的 Chinese description](STORE_UPDATE_0.7.1.md)，运行要求改为 Chrome/Chromium 125+，不要把 Edge 审核状态写为 Chrome 上架状态。

## Privacy practices and permission explanations

Single purpose: translate user-selected webpages and documents with a user-chosen API, with optional research tools that explain the same reading material.

Data-use disclosure should include authentication information (API keys/custom authentication), website content (chosen text, document excerpts/images and research results), and web history/source information (the explicitly captured source origin/path/title, not automatic history collection). Processing can be local or direct to the user-chosen provider as described in the policy. Do not select “no user data” merely because the developer operates no server. No data is sold or used for advertising, unrelated purposes, creditworthiness or lending.

| Permission / capability | Purpose |
| --- | --- |
| activeTab | Read the active page/selection and capture an explicitly requested visible figure after an extension action. |
| scripting | Inject bundled translation/selection UI on the active page, or on a site explicitly enabled by the user. |
| contextMenus | Provide user-initiated translation/document/paper commands. |
| storage | Keep API configurations, preferences and prompt templates locally; bounded research/capture data uses local IndexedDB. |
| Optional HTTP(S) hosts | Call the user-configured API, read its model list, download a chosen remote document/image, and enable selection UI only on a requested site. Arbitrary user-selected providers and document hosts cannot be enumerated in advance. No mandatory all-host permission. |
| Bundled WASM | Local PDF decoding/rendering. CSP permits bundled WebAssembly; no remote parser/code download. |

Remote code: **No**. All executable JS/WASM is in the ZIP. Provider responses, Skills and Python/R drafts are text data, never evaluated/executed. No remote CDN scripts, dynamic downloaded code or developer relay.

Reviewer instructions: [CERTIFICATION_NOTES_0.7.1.txt](CERTIFICATION_NOTES_0.7.1.txt). Do not include a private provider key in the listing, reviewer note or package. Provide the published privacy URL and verify the dashboard's current declarations against the actual extension.

## Validation and remaining submission steps

191 Edge integration checks passed. An installed-Chrome test stopped before integration because the extension service worker did not load; only two pure logic checks passed. This does not verify Chrome operation or official certification. Before review, install the runtime using Chrome's Load unpacked UI and verify settings/model list, a normal webpage and a generated document with a test endpoint.

After developer registration, use New item → upload runtime ZIP → complete Store listing / Privacy practices / Distribution / Test instructions → resolve dashboard validation → Submit for review. Record item ID, upload validation and final review status only after observing them. Never pay a registration fee or accept a legal agreement on behalf of the account holder without the required user action/confirmation.
