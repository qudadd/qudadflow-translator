# QudadFlow Translator 0.8.16

October 23, 2026. All-platform update authorized by the owner. GitHub publication, store submission and store approval are tracked separately in [the publication record](STORE_SUBMISSION_0.8.16.md).

## Roomier figure workbenches

- **展开工作台** opens the existing paper or PDF/Word/TXT/Markdown workbench in a dedicated view that fills the browser viewport. **返回阅读** or Escape restores the reading layout. Selection, search, drafts, results and pending AI requests stay in the same workspace.
- The expanded overview uses larger figure previews and a fixed toolbar for search, selection and batch actions on wide screens. Native webpage tables join the overview while expanded and return to the source column afterward. Optional webpage supplementation stays folded under **核对漏项与补图**.
- Questions and settings occupy the left column; answers and conversation history have a larger reading column. Expanded answers and figure results use the main scroll area instead of small capped result boxes. Narrow screens stack the columns.
- AI candidate review uses larger previews. **查看原页** returns to the PDF without discarding the candidates. Cropping reveals the original page first, then returns to the expanded workbench when a crop is completed. Escape cancels the crop and stays in the reader.
- The installed version remains visible at the bottom in both layouts. Compact document mode still preserves reading space.

## 中文说明

在 Edge 扩展管理中重新加载本地扩展，然后重新打开论文窗口或文档阅读器，确认底部 **v0.8.16**。点击工作台标题右侧的 **展开工作台**，即可单独查看总览、解读与问答、AI 候选核对。点击 **返回阅读** 或按 Esc 返回原布局。

宽屏下图表预览更大，搜索、全选、批量载入及提问操作集中在总览上方；问答设置和长篇结果分栏展示。展开与返回不会重新提取图表或发送 AI 请求；已选择的图表、问题草稿、分析结果和进行中的请求继续保留。

QQ 交流群：1048123205 · 支持邮箱：lcf1249288484@outlook.com。

## Validation scope

**87 behavior checks passed, zero failures:** 8 expanded-workbench checks, 29 PDF AI extraction/review checks, 25 web companion checks and 25 visual supplementation checks. The package also passes manifest, 266 runtime-file, 34 script syntax and local dependency validation. See [verification](VERIFICATION.md).

Validation uses isolated Microsoft Edge profiles, generated papers/images and synthetic API responses. Reports and preview screenshots accompany this release. They check layout, state retention, keyboard navigation, source-page access and existing analysis behavior; they do not measure a real model's accuracy or speed.
