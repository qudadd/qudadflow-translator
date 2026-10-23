# QudadFlow Translator 0.8.9 — PDF local trial

October 22, 2026. **Local testing only.** The user will validate this version before authorizing GitHub or store uploads. Earlier 0.8.8 publication records remain historical.

## PDF figures and tables

Extraction now combines numbered captions with PDF.js raster and vector drawing positions, including side captions and rotated pages. **提取本页图表** checks the current page; **提取全文图表** scans sequentially, reports progress and supports stopping. Repeated extraction at different rendering scales merges the same logical region. Figures and extracted text tables remain available after page navigation; opening another document clears old material.

Native text tables are reconstructed into Markdown/TSV, retain empty cells and enter paper Q&A material. These coordinate-based results are marked unverified. Scanned or complex tables may still need a crop/import and explicit AI transcription. Extraction itself makes no AI request.

## Reading and translation

**翻页方式** offers the existing paged reader and a saved continuous mode. Continuous reading uses page placeholders, renders nearby pages and releases distant canvases. Original and translated panes track the same page and relative position, including resize and mixed page sizes. Layout changes preserve reading position without overwriting a later scroll while rendering is pending.

PDF replacements use original columns, line spacing and available font weight/style. List markers no longer determine body font style. Images, charts and page proportions stay in place. Text that cannot fit remains available through the existing full-translation link; exact font matching and complete fidelity are not guaranteed. Image-only pages retain original pixels and OCR guidance. Full-document translation starts with the current page and reprioritizes remaining pages after navigation. There is no new API deadline.

## Verification and limits

**99 targeted checks passed, zero failures:** 88 behavior checks across PDF reading/extraction, document layout, document parsing and research workflows, plus 11 build/package checks.

The supplied local 10-page PDF yields four labeled figures and one native table with 24 rows including the header and six columns. It exercises raster, vector and text-table content without an API call. The private PDF, extracted crops and screenshots are excluded from repository packages.

Tests use isolated Edge profiles, generated documents, the local sample and simulated translation responses. They verify extraction, navigation, cancellation, layout geometry and package integrity; they do not establish real-provider translation quality/speed or activation in the user's browser. Heuristic detection may miss unlabelled or complex content. Existing document/image resource limits remain applicable. See [VERIFICATION.md](VERIFICATION.md) for current results.

## 中文本地试用步骤

1. 保持现有安装目录，在 `edge://extensions` 对 **QudadFlow Translator** 点击“重新加载”。关闭旧文档阅读器，重新打开，核对底部 **v0.8.9**。复制文件不代表浏览器已经启用新版。
2. 在阅读器重新打开你提供的 PDF。选择 **翻页方式 → 连续阅读**，上下滚动、输入页码、切换原位／左右对照，再切回逐页，核对当前页与页面比例。
3. 展开底部 **AI 图文工作流 → 提取全文图表**。样例应得到 Fig. 1、Table 1、Fig. 2、Fig. 3、Fig. 4，共五项。翻页后应保留，可全选再按需分析。
4. 打开 **可复制文字表格**，核对 Table 1 为 24 行（含表头）、6 列，试用复制 Markdown／TSV。PDF 表格按文字坐标重建，请逐项核对，不能视为自动核验的数据。
5. 在第 2 页试用 **翻译当前页**，核对双栏、列表和行距；原位放不下的段落通过 ↗ 查看完整译文。使用真实 API 的质量、速度由你本地试用确认。

本次不上传 GitHub、Edge 或 Chrome，等待你的验证结果与后续指示。支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。
