# Edge Add-ons update 0.5.0

Name in both languages: **QudadFlow Translator**

Submitted October 21, 2026 (Asia/Shanghai). Partner Center confirmed **In review** for version 0.5.0. See [submission evidence](STORE_SUBMISSION_0.5.0.md). The exact certification text used is retained in [CERTIFICATION_NOTES_0.5.0.txt](CERTIFICATION_NOTES_0.5.0.txt).

## English description

Read webpages and documents in two languages with QudadFlow Translator for Microsoft Edge.

Immersive translation places streamed translations beneath their original paragraphs. Enable the selection button on a site, select a phrase, and translate it in a nearby floating card. Restore original webpage content with one click.

The document reader supports PDF, Word DOCX, TXT, and Markdown. Open a PDF from the current browser tab or select a local file. PDF keeps its original page on the left and translated paragraphs on the right; Word and text use aligned reading paragraphs. Navigate pages, synchronize scrolling, translate one page or the whole document, stop/resume, and export bilingual TXT.

Save, edit, duplicate, delete, and switch between up to 20 named API configurations. Bring your own Google Cloud Translation, DeepL, Microsoft Translator, OpenAI-compatible Chat Completions/Responses, or custom JSON API. Keys and configurations stay in browser-local extension storage.

For a short trial without a key, explicitly enable MyMemory in Settings. It defaults to English → Simplified Chinese and requires a manually selected source language. Typical anonymous allowance is 5,000 characters/day. MyMemory may retain submitted text; use non-private sample text and review its provider terms. No free unlimited service is promised. Other providers may require paid accounts or credentials.

Translations begin only after your action. Requests go directly to the selected provider. Files are parsed locally, and original document bytes are not uploaded to the translation API. Remote document downloads require source-site permission and may use the source site's login cookies. The extension has no developer-operated proxy, advertising, analytics, telemetry, or remote executable code.

Limits: 25 MB, 300 document pages/reading sections, one million extracted characters. Scanned PDFs require external OCR. DOCX images, table layout, headers, footers, and original pagination are not reproduced; complex PDF extraction can require checking. Export is bilingual TXT. Protected browser pages cannot host webpage translation; PDFs use the separate reader. Requires Chromium-based Edge 125+. The extension interface is Simplified Chinese.

Support: lcf1249288484@outlook.com
Guide: https://qudadd.github.io/qudadflow-translator/
Privacy: https://qudadd.github.io/qudadflow-translator/privacy.html

## 简体中文详细说明

QudadFlow Translator 为 Microsoft Edge 提供网页双语阅读和文档左右对照翻译。

沉浸式翻译将译文插入原段落下方，并随接口返回逐步显示。开启本站划词按钮后，选中文字即可在附近的浮窗中翻译；支持一键恢复网页原文。

文档阅读器支持 PDF、Word DOCX、TXT 和 Markdown。可从浏览器当前 PDF 转入阅读器，或选择本地文件。PDF 左侧保留原页，右侧显示该页段落译文；Word 和文本按等高段落对应。支持翻页、同步滚动、翻译当前页/全文、停止续译和双语 TXT 导出。

最多保存 20 个具名 API 配置方案，可选择、编辑、另存、删除，并在弹窗快速切换。支持自带 Google Cloud Translation、DeepL、Microsoft Translator、OpenAI 兼容 Chat Completions/Responses 和自定义 JSON API。密钥与配置仅保存在浏览器本地扩展存储中。

无需 Key 的短文体验可在设置页主动启用 MyMemory。默认英译简中，其他源语言需手动选择；匿名额度通常为每天 5000 字符，服务商可能保留提交文字，请使用非私密样本并阅读相应条款。不是完全不限量的免费服务。其他服务可能需要付费账号或凭据。

只有主动操作才开始翻译，请求直接发送给所选服务商。文件在浏览器本地解析，不向翻译 API 上传原文件。远程文档下载需来源站点权限，可能携带来源站点的登录 Cookie。扩展不运营翻译代理，不包含广告、分析、遥测或远程可执行代码。

文档限制：最大 25 MB、300 页/阅读分段、100 万提取字符。扫描 PDF 需先使用外部 OCR。DOCX 不保留图片、表格版式、页眉页脚和原分页；复杂 PDF 的提取顺序可能需人工核对。导出格式为双语 TXT。浏览器保护页面无法注入网页翻译，PDF 使用独立阅读器。最低要求 Chromium 内核 Edge 125，操作界面为简体中文。

中文指南：https://qudadd.github.io/qudadflow-translator/zh-CN.html
隐私政策：https://qudadd.github.io/qudadflow-translator/privacy.zh-CN.html
支持邮箱：lcf1249288484@outlook.com

## Certification notes

No QudadFlow account is required. To test without provider credentials, open Settings and click “启用 MyMemory 基础试用”, approve access to api.mymemory.translated.net, then test a short English sentence translated into Simplified Chinese. This public service has an anonymous quota and can be unavailable; no shared paid key is embedded.

For deterministic offline review, use the optional localhost fixture described in https://github.com/qudadd/qudadflow-translator/blob/main/docs/REVIEWER_GUIDE.md . The fixture is excluded from the runtime and is explicitly a simulation.

Test documents through popup “PDF / 文档左右对照”. A local TXT file with two English paragraphs is sufficient; a text-based PDF exercises original-page rendering. Verify current-page/all translation, stop/resume, page navigation, and bilingual TXT export. Opening a file alone sends no translation request. Scanned-image OCR and layout-preserving document export are not included.

Optional host access is requested separately for the selected API, sites with selection-button opt-in, and remote document source hosts. No required host grants or remote code are added. Local WASM is used by bundled PDF.js codecs. Saved profile keys stay local and are never included in source/runtime packages.
