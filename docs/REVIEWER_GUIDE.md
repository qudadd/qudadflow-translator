# QudadFlow Translator: certification review (0.9.0)

The extension has no QudadFlow service account. Its default machine translation needs no AI credentials. Optional Google Cloud Translation, DeepL, Microsoft Translator and OpenAI-compatible services use the reviewer's own endpoint and credentials. Optional ChatGPT plan sign-in uses each user's official OpenAI authorization and a separately installed Windows x64 native host. No shared production keys or account are supplied. The UI is Simplified Chinese; English/Chinese store metadata are included.

For basic text testing, leave **自动机器翻译（默认免 Key）** selected in Settings. Approve site access when prompted, open a normal English HTTP(S) webpage and request immersive or selection translation. The extension first tries a ready browser-local Translator model. If the browser supports it, the user may click **下载并准备本地模型** in Settings to download a model for the chosen language pair. Without a ready model, requested text goes immediately to MyMemory over HTTPS. MyMemory's typical anonymous allowance is 5,000 characters/day, possibly shared by network, and its retention/usage terms apply. A personal contact email can be added for the provider's stated higher allowance; no independent per-person public quota is guaranteed. AI research and vision need a compatible API profile/model or an eligible ChatGPT plan account.

## Optional ChatGPT plan preview and nativeMessaging

The new `nativeMessaging` permission is used only when the reviewer explicitly selects **ChatGPT 计划（官方授权，预览）**. The separate Windows x64 host is [a v0.9.0 GitHub release asset](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.0). Extract its ZIP and double-click `Install-Bridge.cmd` to register the host for the current user and both store IDs; no Node.js installation or administrator rights are needed. The browser cannot install or manage the native host. A one-time, dismissible popup offer after install or upgrade opens the setup draft but does not change the active translator. Default machine translation works without the host.

Without installing the host, select ChatGPT plan in Settings and verify the setup guide opens with the public download link and **重新检测** button. With the host installed, sign-in opens `auth.openai.com`, asks the person to authorize their own account, then uses the official model list and an explicit model selection. **测试连接** sends a fixed short sentence and can consume plan allowance; no real reviewer account is provided. If authorization is denied by workspace policy, the UI retains the upstream code/Request ID and directs the user to stop repeated attempts. OpenAI's open-source plan-usage docs currently explicitly list eligible Plus/Pro users; Business/Team usage here remains unconfirmed. The host protects OAuth tokens under Windows DPAPI; the extension stores only an account reference/model and never reads ChatGPT browser cookies. The inference path uses `POST https://api.openai.com/v1/responses` with `store:false`, `stream:true`; it does not switch to paid API billing. See [setup and limits](CHATGPT_LOGIN.md).

## Local manual review without a paid API

The optional source-only simulated API demonstrates the custom JSON path through normal settings and permissions. It is not a translation engine and does not establish live-provider quality.

1. Obtain the source from https://github.com/qudadd/qudadflow-translator . With Node.js 18 or newer, run `node tools/review-api.cjs` from the repository root. It binds only to `127.0.0.1:8765`, logs no request content and sends no external requests. Stop with Ctrl+C.
2. Choose **自定义 JSON 接口** (Custom JSON), endpoint `http://127.0.0.1:8765/translate`, empty API Key, custom headers `{}`, request template `{"text": {{text}}}` and response path `data.translation`.
3. Save and allow the local API domain. **测试连接** tests a fixed sentence using the current draft; it does not save/activate changes, use page text or verify vision. Save explicitly before using a profile elsewhere.
4. Open `http://127.0.0.1:8765/`. The fixture maps **Hello world** to **你好，世界**, **Good morning** to **早上好**, and **Read more** to **了解更多**. Other text is echoed; paragraph markers are preserved.
5. Test immersive insertion, selection translation, copy and restore. Enable the nearby selection button per site; selection alone sends nothing. Stop the local API and inspect the next request's failure message.

## Expanded workbenches in 0.8.16

On a paper or in the PDF/Word/TXT/Markdown reader, click **展开工作台**. Check the larger gallery, sticky search and bulk controls, and **解读与问答** with separate question/answer columns. Escape or **返回阅读** restores the reader without losing selections, drafts, results or pending requests. In AI candidate review, **查看原页** retains candidates; cropping first reveals the original and returns after success. Narrow views stack the columns. The installed version stays at the bottom. Expanding alone makes no API call.

## Reading and configuration

1. Expand Settings → **翻译偏好**. Recolor existing immersive translations without a new request. Type/save or record the webpage shortcut. Default: **Shift+A**. Esc, Tab, blur and Cancel cancel recording. Reset/disable are available. The shortcut excludes editors/inputs and runs only in granted HTTP/HTTPS page bodies. Alt+Shift+I remains a browser-command fallback.
2. Translate a long normal webpage and scroll/expand content. The live viewport is prioritized, dynamic text supplemented and confidently detected target-language text skipped. Translation/AI have no extension-imposed deadline; Stop or actual HTTP/network/stream errors end calls. Downloads retain resource safeguards.
3. For live review, supply valid provider credentials. Read upstream models and explicitly choose one after inspecting reported metadata. Missing metadata remains unknown; some providers lack a model list. Model loading sends no page text. Test the draft, then save. Up to 20 API connections can be saved/switched only in Settings. Reading views discover and select models on the active API, with plain model-ID lists and inline refresh/cancel. No page text goes with discovery. Optional host grants can persist independently of configuration drafts.
4. Settings sections fold independently. Website/API permissions are optional and requested as needed. A separate explicit all-websites grant can reduce repeated prompts.

## Documents

1. Open **PDF / 文档左右对照** and choose PDF, DOCX, TXT or Markdown. Opening/local parsing send no translation request. Test **沉浸原位**, **查看原文**, **原版左右对照** and **段落对照**. PDF proportions and picture/table positions remain; translations that cannot fit retain a full-text fallback. Browser-rendered Word can differ from Microsoft Word.
2. Translate current/all pages, stop/resume and export bilingual TXT. Scanned body replacement needs external OCR; layout-preserving translated PDF/DOCX export is excluded.
3. With an image-capable AI profile, expand the image/paper workflow. Extract pictures or crop a PDF chart, then explicitly analyze selected material. Extraction/loading do not call AI. Inspect output, cancellation, download and unsupported-model errors.
4. Limits: 25 MB/file; 300 PDF/rendered Word pages. Extracted body and TXT/Markdown have no fixed character cutoff; browser/model limits remain. Up to 40 loaded images/32 MB; originals up to 3,200 pixels; screenshot/import images up to 1,600 pixels and 4 MB encoded each. Paper Q&A includes at most four originals/12 MB per request. Native tables: 10,000 rows, 256 columns and 100,000 expanded cells.

## Linked webpage tables (retained from 0.8.8)

Capture a Springer article with numbered figures and full-table links. Repeated thumbnail/companion/original variants merge, while distinct panels remain separate. Eligible same-origin full-table pages automatically load through the bound original article with its site session cookies, without translation API keys or new host permissions. Local inert parsing retains table rows, captions and notes for copy/export and paper Q&A. Failed/challenge pages keep a source link and retry; navigation invalidates the binding. Table HTML downloads have a 20-second/5-MB resource bound; this is separate from AI calls. Saved complete article/table DOM yielded five figures and a 54-row, five-column table; live publisher availability was not established by these fixture tests.

Confirm the running manifest version at the bottom of popup, Settings, reader and research window. After updating an unpacked extension, reload it and refresh the article before a fresh capture.

## Paper Q&A, figures and tables

1. On a normal article webpage, use **论文阅读与问答**. Inspect the movable/resizable window, extracted body, captions and figure/table overview. Capture makes no AI request; each new paper needs explicit capture.
2. Caption/number-aware extraction includes image and native/ARIA tables and excludes ordinary photos. Search and **全选图表** share selection, including search-hidden/pending candidates. Batch-load available originals; host prompts are grouped. Selection/loading do not call AI. Heuristic extraction can miss material.
3. Copy/download native tables as Markdown/TSV locally. Explicitly request vision transcription for image tables, inspect its verification warning and compare with the original. Import/paste a screenshot or supplement the source viewport when needed. Limits: 100 extraction candidates, 12 manual supplements and a 16 MB capture budget.
4. Choose a model on the active API, a Skill and a question. Analyze selected text/figures and export Markdown. Document reading shares this workflow. Source/page references remain visible. AI output/numbers/conclusions need independent checks.
5. Edit/import Skills as plain text prompts. Optional notebook memory defaults off, is notebook-isolated, bounded and exportable as JSON/Markdown. Search/delete records; disabling stops future use/saving without erasing existing records. Basic translation does not use research memory.
6. Generate/download Python/R reproduction drafts. Code is inert text and never executed. Exact reproduction needs original data and verification.

## PDF and model workflow review in 0.8.15

1. Open a text PDF and change **翻页方式** between **逐页翻页** and **连续阅读**. Check current-page navigation, preserved page ratio, current/all-page translation and Stop.
2. In the bottom **图表工作台**, extract the current page or whole document. Inspect named captions, native text-table Markdown/TSV and continued segments. Ordinary extraction makes no AI request.
3. Open **图表总览 → AI 补充识别**, choose page numbers and explicitly recognize. Use an image-capable model on the current API. Review crops in **核对候选**, compare the original page and confirm selected results. Invalid coordinates are diagnosed; valid crops survive neighboring failures. A more complete overlapping crop requires replacement review. Repeat the same table to inspect deduplication.
4. Select all figures and ask a batch question. Extraction, gallery, answers and candidates remain in one collapsible workbench; manual tools begin folded.
5. In each reading view refresh/cancel upstream models. Select a returned ID and inspect shared selection. Change API connections only in Settings. Missing model routes can use a documented manual ID there. Discovery/refresh alone does not select a model or send source content.

## Verification and privacy

The 0.9.0 release checks and package hashes are recorded in the [publication record](STORE_SUBMISSION_0.9.0.md). Isolated Edge, generated papers, private local PDFs and synthetic APIs verify behavior. One personal Pro account previously read eight real models and completed a fixed short text inference; live service speed/quality, Business/Team access and Chrome native-host integration are not established. The 0.8.16 baseline passed 87 behavior checks plus package/syntax validation; historical results are preserved in its own release notes.

Files parse locally; only requested text/selected images and enabled research context go to the chosen provider. Keys/settings stay in browser-local extension storage; ChatGPT OAuth credentials stay in the local companion. No developer proxy, ads, analytics or remote executable extension code. Parsers/WASM are bundled; API output is rendered as text. Protected browser pages cannot receive injected translation controls.

See [verification](VERIFICATION.md), [release notes](RELEASE_NOTES_0.9.0.md), [submission record](STORE_SUBMISSION_0.9.0.md), [privacy](https://qudadd.github.io/qudadflow-translator/privacy.html) and [third-party notices](../THIRD_PARTY_NOTICES.md).

Support: lcf1249288484@outlook.com · QQ community: 1048123205.
