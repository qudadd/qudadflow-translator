# QudadFlow Translator 0.8.2 — Edge trial

Prepared October 21, 2026. This local trial brings paper capture and optional visual supplementation into one research window. GitHub and store publication await the user's testing decision.

## One paper entry, with optional AI supplementation

The popup now has one **论文阅读与问答** action. The previous paper and viewport actions both opened a new research window; the latter added a screenshot of the visible page. They have been replaced by a single flow:

1. Extract the current paper's text, native tables, captions and figure candidates locally.
2. Cross-check numbered references in the material against extracted captions. List unmatched figures/tables, image-based tables, partial table captures and references to unread supplements as items to check.
3. For a suspected omission, choose **返回原文定位**, expand and display the chart in the source page, then choose **补入当前视区截图** in the existing research window. The preview is local. Existing material edits, questions and answers remain in place.
4. Review the preview and explicitly choose **用 AI 补读图表**. A vision-capable model receives the screenshot and relevant material, with instructions to retain numbers, units and footnotes, transcribe tables and mark unreadable cells. Results stay marked **待核对**. They do not overwrite extracted native tables. Select the image to include it in later paper Q&A, or use **结合此图提问**.

Zero tables alone does not mean extraction failed and does not start AI. The reference check recognizes common English/Chinese figure/table numbers, supplemental S numbers and short ranges; references may point to other work. Unnumbered, collapsed, embedded or inaccessible content can still be missed. Generated fallback labels are not treated as proof that a cited figure was found. These checks do not establish that the paper is complete.

The viewport action captures only the currently visible source content, not the whole paper. A large table may need multiple screenshots or an imported image. PNG/JPEG/WebP import and image paste remain available in webpage research and the document reader. Image/table recognition quality depends on the chosen model and requires comparison with the original.

## Source checks and local cache

Supplementation is bound to the original tab, window and document, with its page title and a local URL digest. Closed, refreshed, navigated or unauthorized pages are rejected. The source must still be the active tab in its original window. Switching tabs or changing the viewport during capture aborts the operation. The user can return to the source explicitly or import a screenshot instead; no automatic page scrolling or whole-paper AI request is introduced.

Repeated screenshot content is deduplicated. Up to 12 supplementary screenshots share the original capture's 16 MB image budget, preserving all original figure candidate indices. Supplementing does not extend the original one-hour expiry. Restoring a capture restores its previews without automatically selecting images or calling AI. The temporary source binding stays inside the local cache and is not returned to the research UI or sent to the provider. Captured material still uses the existing source attribution without URL query parameters or fragments.

## Verification

**74 checks passed, zero failures:** 11 reference-coverage checks, 20 paper companion checks, 25 visual workflow checks and 18 research/Skills/memory checks. See [verification reports](VERIFICATION.md). The saved public Ovid paper still yields four unique figures and four independent table cards. Its HTML fixture stays outside the repository and packages.

Checks cover the single popup entry, conservative gap hints, retained material/questions/answers, screenshot restoration and deduplication, explicit AI requests, table transcription instructions, image-assisted follow-up questions, changing/closed/expired sources, source switches during capture, caller restrictions and narrow/wide layouts. Browser checks use isolated Edge profiles, synthetic credentials and local simulated APIs. No real provider key or live AI account was used; real-model accuracy and latency are not established. Chrome integration was not newly tested. The 240 checks recorded for 0.8.1 remain the prior baseline; they were not all repeated for this focused change.

Packaging validates 250 runtime files, 21 first-party scripts and local dependencies, checks staged files, and compares both runtime/source ZIPs byte-for-byte against the source inventory. Runtime packages exclude development tests, screenshots and documentation.

## Try the update

Keep the existing unpacked installation and its directory. Save or export unfinished research, reload QudadFlow Translator in `edge://extensions`, confirm **0.8.2**, then refresh the paper webpage and choose **论文阅读与问答** again. Old capture windows keep their original material. Updating files in the same directory retains browser-local API settings; file copying alone does not activate the new extension code. Automated tests do not reload the user's actual browser installation.

## 中文试用说明

原来的两个按钮用途相关：第一个提取论文并打开问答窗口，第二个额外补充当前视区截图，也会打开窗口。0.8.2 统一为 **论文阅读与问答**，流程为：

**本地提取 → 核对可能缺漏 → 在同一窗口补图 → 按需用 AI 补读。**

提取结果会按正文和图注编号提示待核对的图表、图片形式的表、部分行列和未读取的补充材料。仅“0 张表”不判定失败，也不会自动发送 AI 请求。提示可能来自其他论文的引用，无法保证发现无编号、未加载或跨域内嵌的内容。

发现遗漏后，点击 **返回原文定位**，展开并完整显示需要的图表，再回到论文窗口点击 **补入当前视区截图**。预览仍留在本地；点击卡片的 **用 AI 补读图表** 才发送给所选 AI。结果标注 **待核对**，不覆盖已有原生表格，可勾选图片参与后续问答。补图保留已编辑材料、问题和已有回答。截图只包含当前可见部分，不代表 AI 已扫描整篇论文；较大的表格可分多张补图或导入截图。

本次 **74 项检查通过，0 失败**，包含原文绑定、截图恢复、重复处理、明确调用 AI、长文和通用图表提取回归。测试使用独立 Edge、模拟接口及虚构凭证，未调用真实 AI，因此不代表真实识别准确率。安装文件更新后，在 `edge://extensions` 对原来的 QudadFlow Translator 点击 **重新加载**，确认 **0.8.2**，刷新论文再打开新的问答窗口。

本版供本地试用，尚未发布 GitHub、Edge 或 Chrome 商店。支持邮箱：lcf1249288484@outlook.com；QQ 交流群：1048123205。
