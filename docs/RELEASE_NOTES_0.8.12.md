# QudadFlow Translator 0.8.12 — Compact figure workbench

October 23, 2026. **Local trial only. Wait for the user's verification before GitHub, Edge or Chrome uploads.**

## Changes

Extraction, selection and paper questions now share one workbench with **提取图表**, **图表总览** and **解读与问答** tabs. An additional **核对候选** tab appears only while reviewing AI detections. PDF readers start with the workbench collapsed to one row; the expanded content uses at most 34% of the viewport, capped at 360 pixels, and scrolls internally. Page-range options and manual screenshot tools are collapsed by default. Model selection and task status stay above the active tab, while the question and selection controls appear before previous answers.

The PDF workflow is **local extraction → optional AI localisation → candidate review → questions**. AI supplementation remains an explicit action, with a current-page shortcut and an explicit page-range hint. Candidate review no longer opens a modal or backdrop: the original PDF can still scroll and change pages, and **查看原页** navigates to the candidate's page. Existing crops require explicit replacement; cancel, Stop, document replacement and configuration changes discard unconfirmed candidates.

Both webpage and PDF questions provide **全选图表并提问** beside the question and **全选并提问** in the gallery. The action includes figures outside the current search, preserves an existing question and loads pending originals through the same click's source-permission request. It selects material but sends no AI request until the user clicks Send. Native text tables already accompany the paper material without individual selection.

Selections of at most four images and 12 MB attach the originals directly. Larger selections are read sequentially, one image per request, before one final answer combines every labeled reading with the selected paper text. **N images require N+1 requests**, stated before submission. The synthesis receives unverified AI readings, not the original images, and is instructed to describe that distinction. Per-image readings do not use or save cross-page memory; the final answer follows the selected Skill and memory preference. Stop or an API error prevents remaining readings and synthesis; completed image results remain available. The existing 40-image/32-MB loaded-resource limit remains, and this change adds no paper-text truncation or API countdown.

Site authorization reminders now disappear immediately after consent, before page initialisation completes. Reopening an authorized site leaves no reminder or empty space. Denied or revoked permission restores the retry prompt. The state follows actual browser permissions rather than a permanent dismissal flag; opening the popup does not request permission or start translation.

## Verification

**177 checks passed, zero failures: 166 behavior checks and 11 build/package checks.** See [VERIFICATION.md](VERIFICATION.md). Coverage includes both supplied PDFs, collapsed and expanded reading space, in-workbench candidate review, one-action selections, five-image synthesis, API errors and cancellation, configuration changes, table exports, memory and authorization behavior.

Tests use isolated Edge profiles, synthetic credentials, generated documents and simulated APIs. Authorization outcomes use a browser API harness. These checks establish behavior and layout, not real-model accuracy, provider speed or universal extraction coverage. Private PDFs, page crops and screenshots stay outside repository and package inventories.

## 中文试用步骤

1. 在 `edge://extensions` 重新加载现有解压安装，关闭旧阅读器和论文问答窗口，再重新打开。确认底部显示 **v0.8.12**；复制安装文件不会自动激活新版。
2. 打开 PDF，底部 **图表工作台** 默认收起。展开后，在 **提取图表** 点击 **提取全文图表**；可以继续阅读原文，也可随时收起工作台。
3. 有遗漏时展开 **AI 补充识别**，选择支持图片的配置，使用当前页或填写页码范围。点击 **识别并预览** 后，在 **核对候选** 勾选并加入；用 **查看原页** 对照来源，核对不再遮罩 PDF。图片表格仍可显式转写为可复制表格。
4. 在 **解读与问答** 点击 **全选图表并提问**，或在总览点击 **全选并提问**。网页的待载入原图会在这次点击后按需授权、载入。检查已纳入数量，填写问题并点击发送。超过四张时，观察逐图进度和最终汇总；停止应保留已完成结果。
5. 打开未授权的普通网站，检查扩展中的授权提醒。允许后应立即隐藏，重开也不占位；取消或撤销后可再次授权。授权不会自动翻译或开启划词。

真实图表分析效果由所配置的模型实测。本版等待用户本地验证后再决定上传。支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。
