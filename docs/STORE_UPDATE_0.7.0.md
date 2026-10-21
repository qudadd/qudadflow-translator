# QudadFlow Translator 0.7.0 store update

## English description

QudadFlow Translator provides immersive bilingual webpages, nearby selection translation and document reading with your own API. Choose Google Cloud Translation, DeepL, Microsoft Translator, OpenAI-compatible Chat Completions/Responses, custom JSON, or the optional quota-limited MyMemory trial. Traditional translation and AI both support the core reading features.

Read PDF, Word DOCX, TXT and Markdown with in-place replacement, original-layout comparison or paired paragraphs. PDF preserves page proportions, images and charts. Word renders tables, images and margins in the browser; complex layouts and fonts may differ from Microsoft Word. Text that does not fit retains its original and offers the full translation on click. Translate a page or all pages, stop/resume and export bilingual TXT.

NEW: Extract article text, captions and figures from paper webpages into a research workspace. Use the same paper analysis in the document reader. Choose a close-reading, methods/statistics or figure Skill, or edit/import your own prompt templates. Ask a question and export the streamed analysis as Markdown. Image analysis requires a compatible vision AI model; body translation can keep using a traditional provider.

Optional cross-page memory is off by default. Enable it in a research notebook to reuse related analysis across pages. Records are stored locally, isolated by notebook and bounded by capacity and retention. Settings supports search, deletion and JSON/Markdown export. Ordinary translation does not use research memory. Source information, selected Skills and enabled related context accompany AI analysis requests.

After recognizing a chart, generate downloadable Python or R reproduction drafts and data-requirement notes. The extension does not execute generated code. Check estimated values and supply original data where needed; an image alone cannot guarantee exact scientific reproduction.

Extraction and document parsing happen locally. Analysis starts only when clicked and goes directly to your chosen API. No original document files or passwords are uploaded to translation APIs. Web captures use a short-lived local cache; optional research text persists according to your settings. API profiles and keys stay in browser-local storage. No developer proxy, ads, analytics or remote executable code.

Limits: 25 MB/document, 300 pages/reading sections, one million extracted characters; paper analysis up to 60,000 characters; up to 20 images/24 MB with bounded resolution. Scanned body replacement requires external OCR. Export does not produce layout-preserving PDF/DOCX. Interface: Simplified Chinese. Edge Chromium 125+ required. Provider fees, quotas and retention terms apply; no unlimited free service is promised.

Support: lcf1249288484@outlook.com
Privacy: https://qudadd.github.io/qudadflow-translator/privacy.html

## Chinese description

QudadFlow Translator 提供网页沉浸式双语阅读、就近划词翻译和文档阅读。支持自带 Google、DeepL、Microsoft、OpenAI 兼容、自定义 JSON 接口及可选 MyMemory 有限试用。传统机器翻译与 AI 均可用于基础阅读功能。

PDF、Word DOCX、TXT、Markdown 支持沉浸原位、原版左右对照与段落对照。PDF 保持原页比例、图片和图表位置；Word 保留浏览器渲染的表格、图片和页边距，复杂排版或字体可能与 Microsoft Word 有差异。译文放不下时保留原文，点击查看完整翻译。支持当前页/全文、停止续译和双语 TXT 导出。

新增网页论文研究工作台：提取正文、图注及图表，与文档阅读器共用论文分析。可选择论文精读、方法/统计审查、图表解读 Skill，也可编辑、导入/导出自己的文本模板。支持问题引导、流式分析和 Markdown 导出。图表分析需模型支持图片输入；正文仍可使用传统翻译接口。

跨页记忆默认关闭，主动开启后按研究笔记本隔离，只复用相关分析。记录保存在本地，并限制容量和保留期限；设置支持搜索、删除和 JSON/Markdown 导出。基础翻译不使用研究记忆。分析请求会附带来源、Skill 及已启用的相关上下文。

图表识别完成后，可生成并下载 Python/R 复现草稿和数据要求说明。扩展不自动执行代码；估读数值需核对，缺失原数据需用户补充，单凭图片不能保证精确科学复现。

文档解析和提取在本地完成，点击分析后才向所选 API 发送材料，不上传原文档文件或密码。网页提取使用短期本地缓存，可选研究文本按设置保留。API 方案和 Key 保存在浏览器本地。无开发者代理、广告、遥测或远程可执行代码。

限制：每文档 25 MB、300 页/分段、100 万字符；单次论文分析最多 6 万字；图片最多 20 张/24 MB、分辨率受限。扫描正文需先外部 OCR；不导出版式保真的 PDF/DOCX。界面简体中文，最低 Edge Chromium 125。服务商费用、额度和保留条款各自适用，不承诺无限免费接口。

支持：lcf1249288484@outlook.com
隐私：https://qudadd.github.io/qudadflow-translator/privacy.zh-CN.html

## Certification notes

QudadFlow Translator 0.7.0 has no extension account or shared API key. It calls the user-selected provider directly. Settings offers an explicit MyMemory no-key trial for short non-private English text (typical anonymous quota 5,000 characters/day; provider retention terms apply). Live paper analysis needs the tester's OpenAI-compatible AI profile; figures require an image-capable model.

Review guide and local simulated API/test instructions:
https://github.com/qudadd/qudadflow-translator/blob/main/docs/REVIEWER_GUIDE.md
169 isolated checks passed using generated fixtures and synthetic credentials. Live model quality is not claimed. No keys are included in the package.

Test immersive/selection translation and PDF/DOCX/TXT/Markdown in-place reading. Open a normal article, click the popup paper/figure action, review extracted material, choose a Skill and analyze. Extraction makes no AI call. Remote pictures need an explicit source-domain grant. Analysis sends chosen material, source metadata, Skill and optional context to the chosen AI.

Research memory defaults off. Enable it in a notebook, analyze another page, then test notebook isolation, export and deletion in Settings. Memory uses bounded IndexedDB with retention limits; temporary webpage captures expire after one hour with lazy cleanup. Basic translation remains stateless.

Recognize a figure, then generate/download Python and R drafts with data requirements. Generated code is text and is never executed. All parsers/WASM are bundled. No remote executable code, telemetry or developer proxy. Check cancellation and retained source-page attribution. Scanned-body OCR and layout-preserving PDF/DOCX export are not included.

Privacy: https://qudadd.github.io/qudadflow-translator/privacy.html
Support: lcf1249288484@outlook.com
