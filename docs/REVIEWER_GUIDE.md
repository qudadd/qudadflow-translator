# QudadFlow Translator: certification review (0.8.15)

The extension has no QudadFlow account or login. Live Google Cloud Translation, DeepL, Microsoft Translator and OpenAI-compatible services use the reviewer's own endpoint and credentials. No shared production keys are supplied. The UI is Simplified Chinese; the product name and English/Chinese store metadata are included.

For basic text testing, expand **快速试用 · 无需 API Key** in Settings and click **启用 MyMemory 基础试用**. Approve access to api.mymemory.translated.net and try a short, non-private English sentence. No key is needed; English → Simplified Chinese is preconfigured. The typical anonymous quota is 5,000 characters/day, with provider retention/usage terms. Other source languages need manual selection. This is a limited public service. AI research and vision need a compatible API profile and model.

## Local manual review without a paid API

The optional source-only simulated API demonstrates the custom JSON path through normal settings and permissions. It is not a translation engine and does not establish live-provider quality.

1. Obtain the source from https://github.com/qudadd/qudadflow-translator . With Node.js 18 or newer, run `node tools/review-api.cjs` from the repository root. It binds only to `127.0.0.1:8765`, logs no request content and sends no external requests. Stop with Ctrl+C.
2. Choose **自定义 JSON 接口** (Custom JSON), endpoint `http://127.0.0.1:8765/translate`, empty API Key, custom headers `{}`, request template `{"text": {{text}}}` and response path `data.translation`.
3. Save and allow the local API domain. **测试连接** tests a fixed sentence using the current draft; it does not save/activate changes, use page text or verify vision. Save explicitly before using a profile elsewhere.
4. Open `http://127.0.0.1:8765/`. The fixture maps **Hello world** to **你好，世界**, **Good morning** to **早上好**, and **Read more** to **了解更多**. Other text is echoed; paragraph markers are preserved.
5. Test immersive insertion, selection translation, copy and restore. Enable the nearby selection button per site; selection alone sends nothing. Stop the local API and inspect the next request's failure message.

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

**0.8.15 passed 121 checks, zero failures (110 behavior + 11 build/package).** The bare-ID follow-up reran 27 model checks successfully without adding to that total. 0.8.14 passed 241 checks including three supplied PDFs and manually annotated simulated vision responses. Tests establish behavior, not real-provider speed or accuracy; current Chrome integration was not rerun.

Files parse locally; only requested text/selected images and enabled research context go to the configured provider. Keys/settings stay in browser-local extension storage. No developer proxy, ads, analytics or remote executable code. Parsers/WASM are bundled; API output is rendered as text. Protected browser pages cannot receive injected translation controls.

See [verification](VERIFICATION.md), [release notes](RELEASE_NOTES_0.8.15.md), [submission record](STORE_SUBMISSION_0.8.15.md), [privacy](https://qudadd.github.io/qudadflow-translator/privacy.html) and [third-party notices](../THIRD_PARTY_NOTICES.md).

Support: lcf1249288484@outlook.com · QQ community: 1048123205.
