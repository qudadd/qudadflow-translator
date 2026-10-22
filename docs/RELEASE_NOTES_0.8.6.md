# QudadFlow Translator 0.8.6 — Local Edge trial

Prepared October 22, 2026. This update adds custom immersive text colors, a configurable webpage shortcut and explicit selection of all paper figures/image tables. It is prepared for local testing; no GitHub or store update has been submitted.

## Select all paper figures

In **图表总览**, **全选图表（N）** selects every usable captured figure/image table, including items outside the current search and originals still awaiting loading. **取消全选** clears the shared selection. Search additionally offers **选中筛选结果** for narrower selection. Overview, detail cards and batch analysis share the same selection. The controls are disabled during a locked image workflow.

Selection alone does not download originals or call AI. Use **载入所选原图**, then **批量解读所选** for sequential analysis. Native text tables already participate in paper context without selection. Paper Q&A can combine at most four original images per request; use **下一组（最多 4 张）** for groups. Selecting all does not remove loading or request resource limits.

## Immersive translation colors

Settings → **翻译偏好 → 沉浸式译文颜色** provides a color picker, strict six-digit HEX input, light/dark previews and reset. Changes are saved locally and immediately recolor existing webpage and in-place document translations without making another API request. Original text, document geometry, compare-mode colors and overflow fallback markers retain their existing behavior. Reset restores the default colors, including automatic light/dark webpage colors.

## Configurable webpage shortcut

Settings → **翻译偏好 → 网页沉浸式快捷键** records Ctrl/Alt/Meta with letters, digits or F1–F12, optionally including Shift. **Ctrl+A** is the default. Change, reset or disable it at any time. Color and shortcut preferences are independent of API profiles and preserve translation cache and active work.

The shortcut operates in the body of already authorized HTTP/HTTPS pages; inputs, contenteditable regions and ARIA editors retain Select All. A bundled lightweight listener uses only already granted website access. Full page-reading code is loaded when translation is invoked. Revoking site permission disables the listener's action. Browser-reserved combinations and restricted browser pages remain subject to browser rules. **Alt+Shift+I** remains a browser command fallback; the PDF/document reader retains its own controls.

## Verification and local activation

**245 checks passed, zero failures**, across seven isolated Edge suites: webpage/providers/immersive/color/shortcut (120), configurations (14), document layout/color (20), paper companion/select all (25), research/Skills/memory (19), document reader (34) and publisher capture (13). See [verification reports](VERIFICATION.md).

Checks cover filtered and pending figure selection without downloads/API calls; shortcut configuration, trusted keyboard input, editor exclusions and permission changes; live color updates in shadow roots and frames; unchanged PDF pixels/overlay geometry and Word/TXT/Markdown originals, comparison colors and fallbacks. Desktop and narrow settings/figure-picker layouts were visually inspected. Tests use isolated profiles, synthetic credentials, generated documents and local simulated APIs. They do not establish real-provider speed/accuracy or current Chrome integration. Earlier model, visual supplementation, reference-coverage, table-export and full-build suites remain historical baselines. Packaging separately validates 253 runtime files/24 first-party scripts, staged dependencies, and exact runtime/source ZIP entries and bytes.

Export unfinished research first. Reload the existing unpacked extension at `edge://extensions`, confirm **0.8.6**, refresh the paper and open a fresh research capture. Keep the same installation directory to retain browser-local settings. Copying files alone does not activate the new code.

## 中文试用说明

论文 **图表总览 → 全选图表（数量）** 一次选中全部可用图表，包括筛选外项目和原图待载入项目；**取消全选** 清除全部勾选。搜索时仍可只选筛选结果。原生文字表格已自动进入论文材料，无需逐张勾选。

全选本身不下载、不调用 AI。可依次使用 **载入所选原图 → 批量解读所选**；论文问答每次最多结合 4 张原图，可用下一组分批提问。

设置 **翻译偏好** 可即时修改沉浸式译文颜色，以及录制、重置或停用网页快捷键。默认 **Ctrl+A**，只在已授权网页正文触发，输入框和编辑器保留全选。颜色和快捷键独立于 API 方案，不清除译文缓存。内部页与浏览器 PDF 视图继续使用原有扩展入口。

本轮 **245 项检查通过，0 失败**。本地文件更新后，请在 `edge://extensions` 重新加载，确认 **0.8.6** 并刷新网页。本版供本地试用，等待用户测试后决定后续方案。

支持邮箱：lcf1249288484@outlook.com；QQ 交流群：1048123205。
