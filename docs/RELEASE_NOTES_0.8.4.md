# QudadFlow Translator 0.8.4 — Local Edge trial

Prepared October 22, 2026. This trial adds copyable tables, improves numbered figure/table capture and high-resolution sources, and broadens immersive webpage translation. Publication to GitHub, Edge and Chrome awaits the user's testing decision.

## Copyable tables

Native webpage/ARIA and Word tables provide **复制 Markdown**, **复制 TSV（Excel）**, **下载 .md** and **下载 .tsv** without calling AI. TXT/Markdown pipe tables are indexed across the entire document. Merged cells expand into repeated values; captions, footnotes and truncation notices accompany Markdown exports. TSV preserves numeric strings and multiline fields, treats formula-like content as text, and downloads with a UTF-8 BOM. Spreadsheet software can still autoformat numbers. Clipboard denial exposes selected read-only text for manual copying.

For image tables use **选中图片表格 → 载入所选原图 → 转写所选表格**. Batch transcription sends loaded selections one at a time. Individual images, imported screenshots and PDF page/crop captures offer **提取可复制表格**. A vision-capable model is required. Prompts request original numeric strings, headers, units and footnotes, identify unreadable/missing cells and prohibit inventing exact values from charts. Returned Markdown tables gain the same copy/download controls and an unverified notice. A response without a table reports that outcome honestly. Stop aborts the current request and preserves received output; retry replaces the result.

Native table resource limits are now 10,000 rows, 256 columns and 100,000 expanded cells per table, with explicit truncation notices. These protect the reader from malformed spans and are separate from paper body-text capture.

## Numbered captions and original images

Leading Figure/Fig/Table/图/表 names, adjacent or accessible captions and exact same-page references help identify generic publisher figures and image tables. Thumbnail/caption layout tables are excluded from native data-table counts. Distinct panels sharing a caption remain separate; supplementary items remain explicitly unread.

The overview separates local thumbnails from analysis-ready originals. Direct image links, original/zoom attributes and larger srcsets supply high-resolution sources where available. Image signatures and successful decoding permit valid originals with missing/generic MIME headers while rejecting HTML, corrupt or oversized data. Originals are normalized to JPEG, with a 3,200-pixel maximum long edge and no upscaling; screenshot/import paths retain their 1,600-pixel bound. Original requests retain source permission checks, stored-URL restrictions, omitted cookies, rejected redirects and download timeouts.

The saved Dovepress example yields two named figures and three image tables, zero false native layout tables, and explicitly unread S1/S2 attachments. Its 2,029 × 712 original is retained. This is evidence for the fixture and generic recognition rules, not a guarantee for every publisher. Script-only zoom viewers and protected sources may require a manual screenshot.

## Immersive webpage translation

The former 80-paragraph, 600-record and 12,000-node scan caps are removed. An asynchronous scan covers the page body, open shadow roots and accessible same-origin frames, including short labels. It periodically yields to the browser, prioritizes the viewport, retains bounded paragraph batches/two concurrent requests and streams results.

Browser-local language detection skips confidently recognized target-language text, with conservative CJK/mixed-language handling. Enabled sessions supplement inserted, edited, expanded and lazy content after mutation/scroll/resize/load events. Stale sources cannot receive an earlier translation. Closing the panel, restoring the source, changing configuration or navigating stops supplementation. Restoration preserves original text nodes and link identity; direct flex/grid text keeps a single flow item. Bilingual output can still increase paragraph height. Closed shadow roots, inaccessible frames, image text and unusual fixed layouts remain limitations. The separate page-panel action retains its 12,000-character limit.

## Verification and activation

**218 focused checks passed, zero failures:** webpage/providers/immersive 101, publisher/originals 14, companion/selection 26, visual workflow 25, research/documents 19, numbered-reference coverage 11 and copyable tables 22. See [verification](VERIFICATION.md). Tests use isolated Edge profiles, generated documents, synthetic keys and localhost simulated APIs. No real user API configuration or live AI was accessed. They verify workflows, not real-model accuracy or speed. Chrome integration was not newly verified. Earlier broader build checks remain historical baselines.

Copy controls and table previews were visually inspected at 390, 620 and 1440 pixels. Packaging validates 252 runtime files and 23 first-party scripts, verifies staged dependencies and compares runtime/source ZIP entries with the source bytes. Tests, screenshots, documentation and saved publisher fixtures are absent from the runtime ZIP; publisher fixtures also remain outside the source package.

Export unfinished research, reload the existing unpacked extension in `edge://extensions`, confirm **0.8.4**, refresh the paper and create a fresh research capture. Keep the same installation directory to retain browser-local settings. Updating files alone does not activate the new code in the user's browser.

## 中文试用说明

文字表格可直接复制 Markdown / TSV 或下载文件，适用于网页、Word、TXT 和 Markdown。图片表格可一键选中、批量载入高清原图，再点击 **转写所选表格**；PDF 使用整页、框选或提取图片后点击 **提取可复制表格**。只有转写时才调用所选视觉 AI；结果需对照原图核验数字、单位和缺失单元格。剪贴板不可用时可手动复制下方选中的文字。

加强了图表编号、图注和页内引用的通用识别，区分图片表格与排版表，优先读取页面提供的高清来源。沉浸式翻译移除旧的 80 段上限，增加正文之外、开放 Shadow DOM、同源框架和动态内容的读取，并跳过确认已是目标语言的文字。

本轮 **218 项检查通过，0 失败**，使用独立 Edge 和模拟接口。请在 `edge://extensions` 重新加载原扩展，确认 **0.8.4**，刷新网页并重新提取论文。真实模型效果仍需试用，本版未提交 GitHub、Edge 或 Chrome 更新。

支持邮箱：lcf1249288484@outlook.com；QQ 交流群：1048123205。
