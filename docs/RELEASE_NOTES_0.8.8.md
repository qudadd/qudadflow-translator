# QudadFlow Translator 0.8.8 — Figures, full tables and version visibility

October 22, 2026. Download the versioned installation and source packages from the [GitHub release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.8.8). Edge **0.8.8 is In review**, with 0.8.7 still Live. Chrome remains deferred. Actual submission/approval status is recorded in [STORE_SUBMISSION_0.8.8.md](STORE_SUBMISSION_0.8.8.md).

## Figures and linked tables

Springer thumbnail, reading-companion and original-image variants now share a canonical image identity. Repeated size/format variants merge while distinct panels and identity-bearing query parameters remain separate. Extraction keeps the fuller caption and excludes small download/decorative controls. Items are not merged solely because they have the same figure number.

Explicit article capture discovers eligible same-origin numbered full-table links. The research window automatically reads those HTML pages using the original article's existing site session, parses them locally without executing embedded resources, and adds the complete table to copy/export controls and paper Q&A material. This needs no AI request or new host permissions. Failed tables retain the source link and retry action; navigating the source page invalidates its binding. Ordinary citations, downloads, supplements and foreign-site links are excluded.

Popup, Settings, document reader and research window show **QudadFlow Translator · v0.8.8** at the bottom, obtained from the running extension manifest.

## Verification

**147 targeted checks passed, zero failures:** 136 behavior checks and 11 build/package checks. Saved complete public DOM from the requested [Springer article](https://link.springer.com/article/10.1186/s40001-026-04947-z) produces five figures and one linked table; its saved table page preserves all 54 rows (including the header) and five columns. Simulated source-bound downloads cover errors, redirects, invalid sources, stale documents, duplicate saves, retry, export and complete paper Q&A material. Responsive layouts and version footers were verified.

Tests use isolated Edge profiles, saved public DOM and simulated APIs. They do not establish live publisher download availability, real AI accuracy or speed. Live publisher availability may depend on the source session and site access; it was not established by the fixture tests. Earlier 0.8.7 full-suite results remain historical; current Chrome integration is not verified. See [VERIFICATION.md](VERIFICATION.md).

## 中文更新说明与升级检查

本版修复 Springer 图表因缩略图、侧栏和原图版本而重复展示的问题；同编号的不同分图仍保留。完整表格链接自动尝试读取，成功后可复制或导出 Markdown/TSV，并随正文参与论文问答，无需 AI 转写。读取失败保留原表和重试入口。

1. 在 Edge 扩展管理页找到现有的 **QudadFlow Translator** 解压安装，点击重新加载，确认 **0.8.8**。保持原安装目录，沿用当前浏览器设置。
2. 刷新原论文网页。旧论文窗口保留旧捕获，请关闭旧窗口并从原网页重新打开论文分析。
3. 在给定 Springer 论文中，检查总览为 Figure 1–5 各一项；等待读取 Table 1，核对 54 行（含表头）、5 列，再试用复制/TSV 下载。
4. 可继续测试其他论文，核对独立分图未被误合并。需要结合图像提问时，仍先批量载入原图并勾选。
5. 在弹出面板、设置、文档阅读器或论文窗口底部确认实际运行版本。只复制文件不代表浏览器已启用新版。

本次发布 GitHub 并已提交 Edge 更新，0.8.8 状态为审核中，商店公开版仍为 0.8.7；Chrome 暂缓。GitHub 下载可用与商店审核通过分别记录。翻译和 AI 请求继续等待完成、实际调用错误或手动取消；20 秒超时仅用于表格 HTML 等资源下载。

Support: lcf1249288484@outlook.com · QQ community: 1048123205.
