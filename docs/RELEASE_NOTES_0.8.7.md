# QudadFlow Translator 0.8.7

Prepared October 22, 2026. This release includes the 0.8.x reading, paper and build improvements since the published 0.7.1 baseline.

## Reading controls

The immersive webpage shortcut now defaults to **Shift+A**. In Settings → **翻译偏好 → 网页沉浸式快捷键**, type a combination and click **保存快捷键**, or use **录制快捷键**. Validation reports unsupported combinations instead of silently replacing them. Cancel recording with Esc, Tab, blur or the cancel button. Reset and disable are available. An old unversioned Ctrl+A default migrates to Shift+A; explicitly saved new Ctrl+A and other custom/disabled values remain supported. The shortcut only runs in granted HTTP/HTTPS page bodies and excludes inputs/editors. Alt+Shift+I remains a browser-command fallback.

Customize immersive text colors with a picker or six-digit HEX value. Existing webpage/document translations update immediately without another API call, layout changes or cache clearing. Appearance and shortcut preferences are separate from API profiles.

## Web and document reading

Immersive translation prioritizes the live viewport, supplements dynamic/expanded text and skips confidently detected target-language text. Translation, models, tests and AI analysis have no extension-imposed deadline; actual HTTP/network/stream errors or Stop end calls. Provider limits and download resource safeguards remain. PDF/DOCX/TXT/Markdown provide in-place, original-layout and paragraph comparison. No fixed extracted-body character cutoff is imposed; provider context limits remain. Scanned body replacement needs external OCR; translated layout-preserving PDF/DOCX export is not included.

## Papers, figures and tables

A movable/resizable paper Q&A window captures each opened paper explicitly. Caption/number-aware extraction includes native/ARIA tables and image tables, excludes ordinary photos, cross-checks references and offers manual screenshot supplements when needed. The overview supports **全选图表**, search and shared selection. Batch original-image loading combines host permission requests; selection/loading do not call AI. Native tables copy/download as Markdown or TSV. Image-table vision transcription stays marked for verification. Paper Q&A may combine up to four original images per request; all-selection does not remove resource limits.

Editable Skills, optional exportable cross-page notebook memory (default off), figure explanations and downloadable Python/R drafts are shared by web and document workflows. Code is never executed. Model discovery requires explicit selection and preserves unknown metadata. Settings fold independently and offer explicit optional all-websites access.

## Verification and release artifacts

**342 checks passed, zero failures: 331 behavior checks across eleven isolated Edge suites and 11 build/package checks**; details are in [VERIFICATION.md](VERIFICATION.md). Tests use synthetic credentials, generated documents, saved public fixtures and local simulated APIs. No real user API or live AI was accessed. The checks establish behavior, not real-provider speed/quality or current Chrome integration.

Runtime and source ZIPs, exact-entry audit and SHA256 checksums accompany the GitHub release. Store descriptions and six screenshots are refreshed in English/Chinese. GitHub release and store review states are separate: see [submission record](STORE_SUBMISSION_0.8.7.md).

## 中文说明

默认快捷键改为 **Shift+A**，设置中可手动输入并保存，或录制；非法组合明确提示，取消录制不会误保存。旧版默认 Ctrl+A 自动迁移，明确自定义及停用值保留。颜色即时修改不重译，论文图表支持一键全选、批量原图、图片表格识别与可复制表格。沉浸翻译优先当前视区，翻译/AI 不设固定超时。

网页及 PDF/Word/TXT/Markdown 共用论文问答、Skill、默认关闭的跨页记忆和 Python/R 草稿。原生表格本地复制，图片表格 AI 转录需核对；仍有文件、图像与服务商上下文资源限制。

更新已有解压安装时，保持同一路径，在 `edge://extensions` 重新加载并确认 **0.8.7**，再刷新网页并打开新的论文捕获窗口。设置保留在当前浏览器。商店版等待审核通过后自动更新。

Support: lcf1249288484@outlook.com · QQ community: 1048123205.
