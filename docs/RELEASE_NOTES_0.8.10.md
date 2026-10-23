# QudadFlow Translator 0.8.10 — PDF extraction during translation

October 23, 2026 (Asia/Shanghai). **Local trial only; no GitHub or store upload.** The user will verify this version before deciding whether to publish.

## Fix

When body translation was still waiting for an API response, 0.8.9 disabled **提取全文图表** even though extraction runs locally. Clicking **提取本页图表** on a page without figures then left the gallery empty and the all-page action unavailable. The supplied PDF's first page has no extractable figures; its figures and table appear on later pages.

All-page extraction and local screenshot import now remain usable while body translation is pending. Stopping extraction preserves the translation request; stopping translation preserves extraction and its loaded figures. Local extraction makes no additional API request. AI analysis still waits for body translation to release its shared request slots, and retains its existing limits.

The extraction controls now appear before the gallery and paper Q&A. **提取全文图表** is the primary PDF action. A current-page result explicitly identifies that page; already extracted items and an empty page have distinct messages.

## Local verification

**103 targeted checks passed, zero failures:** 92 behavior checks and 11 build/package checks.

Held synthetic API responses reproduce the original disabled-button failure in 0.8.9 and pass after the fix. Generated and supplied PDFs verify extraction while a body request remains pending, independent stop controls, five unique sample regions and native-table copying. Tests also exercise paged/continuous navigation, document replacement, original page proportions, text fitting, colors and research workflows. Current reports are in [VERIFICATION.md](VERIFICATION.md).

Tests use isolated Edge profiles and simulated translation APIs. They do not access the user's browser settings or establish real-provider quality/speed. The private PDF, crops and screenshots remain outside repository packages. Figure detection is heuristic; coordinate-based PDF tables require checking against the original, and scanned text still needs OCR.

## 中文复测步骤

1. 在 `edge://extensions` 重新加载原有解压安装，关闭旧阅读器后重新打开 PDF，核对底部 **v0.8.10**。只复制文件不代表浏览器已启用新版。
2. 展开 **AI 图文工作流**，点击顶部蓝色 **提取全文图表**。无需停止正在进行的正文翻译，也不需要等待 AI 返回。
3. 当前示例应有五项：第 3 页 Fig. 1、第 5 页 Table 1、第 6 页 Fig. 2、第 7 页 Fig. 3、第 8 页 Fig. 4。第 1 页单独提取为 0 属于当前页结果。
4. 打开 **可复制文字表格**，核对 24 行（含表头）、6 列后试用复制或导出。需要 AI 解读时，正文翻译完成或手动停止后，再选择图表分析。

本版继续只供本地试用，等待用户验证后再上传。支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。
