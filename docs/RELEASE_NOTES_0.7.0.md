# QudadFlow Translator 0.7.0

Paper research now works across webpages and PDF, Word DOCX, TXT and Markdown, alongside immersive and selection translation.

- Extract webpage article text, figure captions and images into an editable research workspace. Visible SVG/canvas charts support viewport crops; remote images load only after an explicit action and source permission.
- Analyze research questions, methods, statistics and evidence using three built-in Skills or your own imported/edited prompt templates. Stream, stop and export results as Markdown.
- Opt into cross-page memory, isolated by notebook. IndexedDB stores deduplicated bounded text records; Settings provides retention/context limits, search, deletion and JSON/Markdown export. Memory defaults off and does not affect ordinary translation.
- Recognize figures and generate separate downloadable Python and R drafts with data requirements. The extension never executes code. Original data and independent verification are needed for scientific reproduction.
- Preserve a figure's extraction-page attribution when navigating a PDF. Report memory-save failures without losing the completed analysis.

This release also includes 0.6.0's PDF original-position replacement, Word browser layout and optional vision workflow. Traditional translation and AI both support basic reading; enhanced paper/figure analysis requires an AI profile. Scanned-body OCR and layout-preserving PDF/DOCX export remain outside this release.

Limits: paper input 60,000 characters; 20 custom Skills; memory 300 records / two million content characters, with 90-day default retention; per request at most six memory records and 6,000 characters by default. Web captures use a separate four-entry, one-hour local cache with up to 16 MB image bytes each. See the bilingual privacy policy for transmitted sources, image capture, exports and deletion.

Validation: **169 isolated checks passed, zero failures** (87 webpage/provider, 34 document, 13 configuration, 17 layout/figures, 18 research). Generated fixtures and simulated APIs were used; real-provider performance, model accuracy and generated-code execution were not tested.

Edge 125+ required. Reload an unpacked installation after replacing its files and refresh open pages. Store status is recorded in [STORE_SUBMISSION_0.7.0.md](STORE_SUBMISSION_0.7.0.md); GitHub release availability does not imply Microsoft approval.

## 中文说明

0.7.0 新增网页论文图表提取，与 PDF、DOCX、TXT、Markdown 共用论文分析、Skill、跨页记忆和 R/Python 复现草稿流程。内置三种分析模板，可自行编辑和导入/导出；记忆默认关闭，开启后按笔记本隔离，设置中可搜索、删除和导出。分析结果流式显示，支持停止和 Markdown 下载。

图表识别后可分别生成 .py/.R 草稿及说明，不自动执行；缺失数据需用户提供，估读值需核对，不能仅凭图片保证精确复现。PDF 翻页后仍保留图表原始来源页码。本版同时包含 0.6.0 的文档原位翻译与底部图文 AI。169 项隔离测试全部通过，不代表真实服务商速度或模型质量；商店是否已通过审核以提交记录为准。
