# QudadFlow Translator 0.8.5 — Local Edge trial

Prepared October 22, 2026. This update removes extension-imposed API deadlines, improves viewport scheduling, narrows paper capture to figures/tables, and simplifies original-image loading and optional website authorization. It is prepared for local testing; no GitHub or store update has been submitted.

## API waiting and cancellation

Translation, upstream model discovery, draft connection tests, and paper/figure/code AI requests wait without an extension deadline. Legacy timeout settings are ignored. Pending calls keep the MV3 worker active, including while waiting for response headers. Actual HTTP/network/stream failures stop the call; HTTP errors are reported before reading a potentially unfinished error body, without automatic parameter retries. Leave Temperature empty if the upstream model does not accept it.

**停止测试** cancels a pending draft test without saving settings. A test belongs to its settings tab; another tab cannot cancel it. Closing or leaving the owning tab cancels its pending model/test requests. Existing translation and research Stop controls remain available. Upstream gateways and browser/network infrastructure can still end a call. Document/image download safeguards remain separate.

## Current-viewport priority

Each free immersive worker ranks pending text against the live viewport. Scrolling changes the next batch without aborting running API calls. Visible and offscreen paragraphs do not share a batch. A long paragraph yields between chunks, and an idle worker can immediately translate newly expanded visible text while another request waits. Two concurrent requests, streaming, local target-language skipping and precise source restoration remain supported.

## Paper figures and batch originals

Paper image candidates require numbered captions/references, an explicitly captioned figure/table panel or chart semantics. Ordinary article images, unlabeled canvases and automatic whole-viewport images are excluded. Native tables and image tables remain available; explicit screenshot supplements still support difficult or unlabeled material. Recognition is heuristic and may miss figures without useful labels.

In **图表总览**, **批量载入全部原图** loads pending originals without selecting them individually. Searching changes the action to **载入筛选结果原图**; **载入所选原图** remains available. A batch combines source permission requests, reports progress and supports failed-item retries. Loading makes no AI call. Existing limits of 40 loaded images/32 MB, source validation and original-image size safeguards remain.

## Optional persistent website access

Under **网站与 API 访问权限**, **一次授权所有网站** explicitly requests persistent HTTP/HTTPS access. One browser confirmation reduces subsequent page, original-image and API dialogs. This is optional and uses the existing optional host declaration; mandatory manifest permissions are unchanged. It permits reading those sites but does not enable every site's selection button or start translation/analysis automatically.

**恢复按站点授权** clears optional website grants, including existing individual/API origins. They can be granted again when needed. Browser-internal and store pages retain browser restrictions; file-URL access remains a separate browser extension-detail control.

## Verification and local activation

**264 checks passed, zero failures**, across eight isolated Edge suites. See [verification reports](VERIFICATION.md). A real headless Edge instance completes a synthetic API call that waits 47 seconds before response headers. Other tests cover live viewport ordering, long-paragraph fairness, new content during pending calls, HTTP errors, cancellation ownership, paper-only candidates, batch original loading, and permission grant/denial/revocation. The saved Dovepress fixture retains two figures, three image tables and its 2,029 × 712 original.

Tests use synthetic credentials, generated documents, saved public fixtures and localhost simulated APIs. They do not read user API settings or call live AI, and do not establish real-model speed or accuracy. Current Chrome integration is not verified. Earlier coverage/table-export/full-build suites remain historical baselines. Current packaging validates 252 runtime files and 23 first-party scripts, checks staged dependencies, and audits exact runtime/source ZIP entries and bytes.

Export unfinished research first. Reload the existing unpacked extension at `edge://extensions`, confirm **0.8.5**, refresh the paper and create a new research capture. Keep the same installation directory to retain browser-local settings. Updating files alone does not activate the new code in the browser.

## 中文试用说明

API 调用已取消扩展固定倒计时，等待实际完成、报错或手动停止；测试连接新增 **停止测试**。滚动后优先调度新视区，保留正在等待的请求，长段落分块之间让出位置。

论文默认只列图表，排除普通网页配图及自动整视区图。使用 **批量载入全部原图** 即可统一加载，搜索后可只加载筛选结果，仍支持勾选加载及失败重试。手动补图继续可用，载图不会自动调用 AI。

设置 **网站与 API 访问权限 → 一次授权所有网站**，经浏览器确认一次后持久保留，减少后续弹窗；可恢复按站点授权。内部页、商店页与本地文件仍遵循浏览器自身限制。

本轮 **264 项检查通过，0 失败**。本地文件更新后，请在 `edge://extensions` 重新加载，确认 **0.8.5**，刷新论文后重新提取。本版供本地试用，未发布 GitHub、Edge 或 Chrome 更新。

支持邮箱：lcf1249288484@outlook.com；QQ 交流群：1048123205。
