# QudadFlow Translator 0.8.11 — Caption-led PDF extraction

October 23, 2026. **Local trial only. No GitHub, Edge or Chrome upload before the user's verification.**

## Changes

The supplied 42-page manuscript repeats journal artwork on every page. Earlier raster extraction treated that artwork as unnamed images and could exhaust the gallery before reaching the research figures. PDF extraction now uses Figure/Table identifiers and captions to associate raster/vector content, excludes margin artwork and stops automatically importing anonymous images. Full-document extraction scans metadata first, then connects captions on adjacent pages, groups continued panels and follows ruled tables with matching columns. Interrupted scans do not apply incomplete document-level associations.

The sample produces **Figures 1–4 and Tables 1–2 in 17 page segments**: six figure segments, ten segments of Table 1, and one Table 2. Figure 1's caption is on the next page, Figures 2 and 3 have split panels, and Figure 4 also has a following-page caption. The ten-page Table 1 retains nine columns; Table 2 has seven rows including its header and eight columns. Native table reconstruction provides Markdown/TSV and remains explicitly unverified. Section-numbered, unruled supplementary tables on pages 29–42 are not covered reliably by the local detector; AI or manual supplementation remains available.

**漏识别？AI 补充定位图表** is a separate, optional action. The user selects an image-capable AI profile and explicit page range; an empty range means only the current page. It sends page images, including body text, and extracted page text sequentially. It does not automatically run after local extraction, use notebook memory/Skills or save localisation responses. Validated crop candidates appear in a selectable preview before insertion. Existing crops are protected by page/identity/overlap deduplication; changed named crops require explicit replacement, which clears the replaced item's analysis/code drafts. Invalid JSON, unreliable bounds and HTTP failures produce visible errors. Stop cancels the active request; document or configuration changes dismiss unconfirmed previews. No API countdown is added. Image-table crops can use the existing explicit AI transcription action to obtain copyable text.

The popup automatically reminds users to authorize an ungranted current website. **授权当前网站** requests only its HTTP(S) host, on all ports, inside the button click's browser confirmation gesture. Opening the popup does not request permission. Denial leaves a retry; granted websites hide the reminder. Protected browser and store pages explain the alternative instead of offering a grant. Authorization does not start translation or enable selection buttons. English and Chinese privacy statements describe both additions.

## Verification

**182 checks passed, zero failures:** 171 behavior checks and 11 build/package checks. See [VERIFICATION.md](VERIFICATION.md) for reports. Coverage includes both supplied PDFs, original proportions, continuous reading, pending body translation, native-table exports, AI previews, deduplication, cancellation, stale results, research workflows and authorization UI. Existing fixtures now label their intended research images instead of relying on the removed anonymous-image fallback.

Tests run in isolated Edge profiles using generated documents and simulated APIs. Authorization dialogs are simulated in UI checks. They do not access real user keys/settings or establish actual vision-model accuracy, translation quality, provider speed or universal publisher coverage. Private PDFs, extracted crops and screenshots remain outside repository packages.

## 中文试用步骤

1. 在 `edge://extensions` 重新加载原有解压安装，关闭旧阅读器并重新打开文件，核对底部 **v0.8.11**。复制本地文件不会自动激活浏览器里的新版。
2. 打开这份 42 页论文，在底部 **AI 图文工作流** 点击 **提取全文图表**。预期为 Figure 1–4、Table 1–2，共 17 个页面分段；同编号的“续页”表示跨页内容，期刊横幅不应再占用总览。
3. 展开 **可复制文字表格**，核对 Table 1 的十个页面分段及 Table 2，试用 Markdown / TSV 复制、导出。文字坐标重建仍需对照原文检查数字、换行及合并单元格。
4. 补充表格可尝试 **漏识别？AI 补充定位图表**，先选择支持图片的配置，再填 `29-33` 等小范围。确认这些页面可以发送给该 API 后点击识别，在预览里核对、选择并加入；图片表格再点击 **提取可复制表格**。AI 未经真实服务验证，效果由你配置的模型决定。
5. 打开尚未授权的普通网站，再点击扩展图标，检查自动提醒和 **授权当前网站**。拒绝应保留重试；授权后提示隐藏，翻译和划词仍由你主动开启。已授权网站无需重复提示，内置页/商店显示使用说明。

本版等待用户本地验证后再决定上传。支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。
