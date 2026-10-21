# QudadFlow Translator 0.6.0

Development preview. Not submitted to Microsoft Edge Add-ons. Version 0.5.0 was last confirmed In review on October 21, 2026; this preview does not replace that submission.

Traditional MT and AI both provide the base immersive and selection translation features. This release adds original-position document translation and optional vision AI tools.

- PDF text replacement keeps page proportions, raster images and vector charts. Original-layout comparison and paragraph comparison remain available. Long/unsupported text keeps its source and opens its full translation on click.
- Word DOCX renders tables, images, margins and pages in the browser, with measured text overlays. TXT/literal Markdown keep reading-paragraph positions. Word fidelity can differ from Microsoft Word; use PDF for strict layout requirements.
- The bottom AI workflow extracts local pictures, allows PDF chart cropping or whole-page capture, previews/downloads images, and translates their text with chart explanations. A separate saved vision AI profile works alongside traditional body translation. Only explicit analysis sends selected images; cancel and configuration changes stop active work.
- Body export remains bilingual TXT. No layout-preserving PDF/DOCX export or built-in scanned-page OCR replacement. Chart AI provides text and explanations, not redrawn charts.

Limits: 25 MB per document, 300 pages/reading sections, one million extracted text characters. Images: longest edge 1,600 pixels, at most 4 MB encoded each and 20 images/24 MB total. Document and image state stays in tab memory. Images bypass the text cache; downloaded files persist. See the updated privacy policy.

All parsing/rendering libraries are bundled: PDF.js 6.4.299, fflate 0.8.3, docx-preview 0.4.1 and JSZip 3.10.2. Requires Chromium-based Edge 125+. Reload an existing unpacked installation after replacing its runtime files.

Verification: 151 checks passed, zero failures, in isolated Edge with generated documents, synthetic keys and local APIs: 87 webpage/provider + 34 document + 13 configuration + 17 layout/figure checks. Pixel checks verify unchanged chart/image regions and retained overflow originals. Real provider accounts, private settings, latency and image-analysis quality were not tested.

## 中文说明

传统接口与 AI 均提供基础沉浸式翻译及划词翻译。0.6.0 新增 PDF 原位文字替换，保持页面比例和图表位置；Word 在浏览器中保留表格、图片和页边距，复杂排版可能与 Microsoft Word 有差异。支持沉浸原位、原版左右对照、段落对照；长译文放不下时保留原文，点击查看完整译文。

底部 AI 图文工作流可本地提取图片、框选 PDF 图表或提取整页，预览后点击分析，才向所选视觉 AI 发送图片并生成文字翻译和图表解释。图表 AI 可单独选择已保存方案，正文继续用传统接口。支持下载图片、停止分析与配置切换取消。

正文仍导出双语 TXT，不导出版式保真的译后 PDF/DOCX。扫描正文原位替换需先外部 OCR；AI 阅读页图不自动替换扫描文字。151 项模拟接口检查通过，不代表真实 API 速度或翻译质量。此版本为开发预览，尚未提交商店；更新侧载目录后须在 Edge 重新加载扩展。
