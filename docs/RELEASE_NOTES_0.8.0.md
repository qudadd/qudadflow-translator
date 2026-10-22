# QudadFlow Translator 0.8.0 — Edge trial candidate

Historical trial notes. The current local candidate is [0.8.1](RELEASE_NOTES_0.8.1.md), with the table updates, full regression results and build improvements.

Prepared October 21, 2026. This version is for local Edge testing. It has not been submitted to Edge Add-ons or Chrome Web Store, and no GitHub release has been published for it. The user will test before choosing further changes or publication.

## Paper reading and questions

- The paper action opens an independent movable/resizable window with maximize/restore controls. The source pane and analysis options collapse to leave more reading space.
- Ask follow-up questions, use question presets, send with Ctrl/Cmd+Enter, reset a conversation or export Markdown. Headings, lists, tables, code and links render as inert content. Up to 20 turns stay in the window; requests include at most six completed turns/24,000 characters.
- Load and select up to four original figures/12 MB per question. Requests combine their images, captions and source labels with paper text; previous figure interpretations are explicitly unverified. Chat Completions and Responses both support this input. Text-only questions remain available without images.

## Generic capture and long material

- Detect article, main, articleBody and common article containers; prefer substantive material over teasers. Preserve inline prose, citations, sections and HTML tables. Inventory lazy/offscreen figures without scrolling or automatic downloads, choose higher-resolution sources and keep distinct panels sharing one caption.
- Open another paper and run the paper action again for a fresh capture. Each companion retains its own source; optional notebook memory is separate. No automatic background crawling or supplement reading is added.
- Remove fixed paper-body and imported-text character cutoffs. Full-document research preserves the extracted ending. TXT/Markdown no longer have a 300-reading-section rejection. PDF/Word retain a 300-page bound and all files retain a 25 MB bound; provider context/request limits still apply.
- List up to 100 figure candidates. Capture storage retains metadata after its 16 MB pixel budget is exhausted. A window can load up to 40 images/32 MB. Per-image limits remain 1,600 pixels on the longest edge and 4 MB encoded. HTML tables retain a 300-row/40-column bound with a visible truncation notice. Unread supplements are listed separately.
- Display HTML/ARIA tables independently of the collapsed source pane, with captions, footnotes, row/column counts and safe Markdown previews. Scan sibling table/figure panels outside the article, expand row/column spans, and deduplicate responsive table copies.
- Add explicit viewport capture and local PNG/JPEG/WebP screenshot import/paste to both web research and document workflows. Previews are not automatically selected or sent. Vision prompts require row/column transcription, preserved numeric values and footnotes, and unreadable/missing-cell labels. PDF cropping temporarily collapses the analysis panel to leave space for selection.

## Waiting, errors and settings

- AI paper, figure and code analysis has no extension-imposed deadline. Elapsed time is shown; HTTP, network, SSE and premature-stream-end failures remain visible. Stop aborts the request. Partial answers can be exported but are excluded from follow-up context.
- Basic translation keeps its configurable timeout. Upstream model discovery keeps its separate 15-second deadline. Browser/network and provider limits still apply to AI analysis.
- Settings sections collapse individually or all together and remember fold state locally. Sidebar/hash navigation reveals its target. Existing saved API configurations are preserved by an in-place extension update.

## Validation and limits

The initial 0.8.0 baseline passed 210 checks across seven suites. After the table and visual-fallback changes, **67 current checks passed, zero failures**, across companion (20), visual fallback (12), research (18) and layout/figure (17) suites. Coverage includes sibling/ARIA/single-column tables, a saved public Ovid paper with four figures and four independently displayed tables, screenshot import/paste/duplicates/errors, source replacement during import, explicit vision requests, and PDF region selection. The companion suite also verifies delayed response headers (36 seconds), follow-ups, stream failures and full text over 200,000 characters. Unchanged baseline suites were not rerun for this patch.

Tests use isolated Edge profiles, synthetic keys and local mock APIs. No real API key is read and no live AI quality or latency is measured. Screenshots show simulated answers. The copyrighted Ovid HTML fixture is not included in the source package. See [verification](VERIFICATION.md).

Extraction remains heuristic. Protected frames, images inaccessible to the browser, image-only tables, external supplements and scanned PDF body text may need manual input or OCR. Generated Python/R stays an unexecuted draft. Chrome integration is not newly verified. There is no layout-preserving translated PDF/DOCX export.

## 中文试用说明

0.8.0 仅供本地 Edge 试用，暂未提交商店或发布 GitHub Release。打开任意普通论文网页，点击扩展 → **论文问答浮窗 / 图表提取**。先核对原文、表格和图表候选，再载入原图、勾选 **纳入论文问答** 并提问。以后打开新论文，再次点击入口即可重新识别；旧窗口保留旧来源，不会混入新论文。PDF、DOCX、TXT、Markdown 在文档阅读器底部使用同一问答与图表功能。

全文正文不再按固定字数截断；上游上下文和请求大小限制仍然适用。AI 分析只显示实际等待时间，遇到真实接口或流错误时报告，可随时停止并导出已收到内容。设置页支持分区收缩及一键展开/收起。跨页面笔记记忆默认关闭。

已侧载的扩展：关闭未保存的研究任务，将运行文件更新到原侧载目录，在 `edge://extensions` 点击该扩展的“重新加载”，再刷新论文网页；保持原扩展安装和目录以保留其本地 API 配置。不要卸载扩展或清除数据。若原来是商城安装，单独加载试用目录通常会形成另一扩展，不会自动继承商城扩展的 API 设置。

本轮电脑控制工具因无法可靠识别浏览器网址而停止，尚未完成用户浏览器中的安装更新。可先使用已验证的 ZIP 和源码审查改动。支持邮箱：lcf1249288484@outlook.com；QQ 群：1048123205。
