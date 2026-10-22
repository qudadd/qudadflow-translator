# QudadFlow Translator 0.8.3 — Edge trial

Prepared October 21, 2026. Select and work with multiple figures from one overview without opening each detail card. This is a local Edge trial; GitHub and store publication await the user's testing decision.

## Figure overview and batch actions

The shared **图表总览** in webpage research and the document reader displays loaded thumbnails and pending figure metadata. Search figure numbers, captions or page labels, then select directly, choose **选中筛选结果**, **仅选未分析** or **清空选择**. The overview and detail checkboxes share one selection. The status explicitly counts selected items outside the current search.

**载入所选原图** requests the required source permissions together, then downloads selected pending originals sequentially. Selecting a pending tile does not load an image or call AI. Failed originals stay selected for retry; successful items keep their position and selection. **批量解读所选** explicitly sends selected loaded images to the configured AI, one at a time. Stop retains completed results. Native text tables already participate in paper Q&A through the captured material, without individual selection; **展开全部表格 / 收起全部表格** controls their previews together.

**下一组（最多 4 张）** cycles through loaded images in the current search, replacing the selection. **结合所选提问** focuses the question field and retains a custom question; sending remains explicit. Paper Q&A accepts at most four selected original images with a combined 12 MB image limit. Sequential batch analysis can include more than four. Pending images and invalid Q&A selections show a message before sending and preserve existing answers. Gallery selection and search live only in window memory; replacing the document clears them.

PDF selection persists while navigating its pages and retains each image's original extraction page. DOCX, TXT, Markdown and imported images use the same overview for available figures. This update does not make image extraction exhaustive or establish live-model recognition accuracy.

## Verification and activation

**70 focused checks passed, zero failures:** companion/selection 26, visual workflow 25 and research/documents 19. See [verification](VERIFICATION.md). Checks cover batch permission/loading/retry, shared selection, filtered sequential analysis and cancellation, grouped Q&A, preserved answers, stale operations, table previews, PDF navigation and document replacement. The overview was visually inspected at 390, 620 and 1440 pixels. Tests use isolated Edge, generated material, synthetic keys and simulated AI; real-model accuracy and latency are not measured. Chrome integration was not newly tested. Earlier full-build and coverage suites remain prior baselines.

Packaging validates 251 runtime files and 22 first-party scripts, checks staging, and audits both ZIPs against the source bytes. Development tests, screenshots and documentation stay out of the runtime package.

Save or export unfinished research. Keep the existing unpacked installation directory, reload QudadFlow Translator in `edge://extensions`, confirm **0.8.3**, refresh the paper and open **论文阅读与问答** again. Existing windows retain their earlier material. Updating files alone does not activate the new code; automated checks do not reload the user's actual installation.

## 中文试用说明

新增 **图表总览**，无需逐张点开详情。可直接勾选、按图号／图注／页码搜索，使用 **选中筛选结果** 或 **仅选未分析**，再点击 **载入所选原图**、**批量解读所选**。下载失败项保留选择，重试时跳过已载入项；批量解读逐张进行，停止后保留已完成结果。总览和详情勾选同步，筛选外的已选数量也会显示。

论文问答可点击 **下一组（最多 4 张）** 快速分组，再点击 **结合所选提问**；已有问题不会被替换，点击发送后才调用 AI。每次问答最多结合 4 张原图／12 MB，批量逐图解读可选择更多图片。已提取的文字表格自动随正文参与问答，无需勾选；预览支持一次展开或收起全部。

网页论文与 PDF、Word、TXT、Markdown 阅读器共用这套操作。PDF 翻页保留已选图片及原始页码；更换文档会清空选择和搜索。选择、搜索和载入原图不会调用 AI。

本轮 **70 项检查通过，0 失败**，使用独立 Edge 和模拟接口，未测试真实模型准确率或速度。本地安装目录更新后，请在 `edge://extensions` 点击原扩展的 **重新加载**，确认 **0.8.3**，刷新论文并重新打开问答窗口。本版供本地试用，尚未发布 GitHub、Edge 或 Chrome 商店。

支持邮箱：lcf1249288484@outlook.com；QQ 交流群：1048123205。
