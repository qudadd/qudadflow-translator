# QudadFlow Translator 0.8.15

October 23, 2026. Publication authorized by the owner. GitHub release, store submission and store approval are tracked separately in the [publication record](STORE_SUBMISSION_0.8.15.md).

## Upstream models in every reading view

The popup, PDF/Word/TXT/Markdown reader and paper/figure workbench automatically read the active API's model list when no cached catalog exists. Refresh or cancel inline and select a shared model. Dropdowns display model IDs only. No first result is selected automatically; the existing model survives a failed or empty read. API connections are created and switched only in Settings, with **新增 API 配置并使用** preserving the previous connection.

Discovery uses the saved endpoint, headers, credentials and host grant; it sends no page text. Simultaneous views share one request per connection, and lists persist within a bounded local cache. Connection changes cancel stale discovery. Some gateways do not expose a model route; enter their documented ID in Settings. Model names do not guarantee image support.

## PDF reading and evidence extraction since 0.8.8

- Switch between page-by-page and continuous reading. Keep original PDF page proportions, chart positions and a full-text fallback for translations that cannot fit.
- Extract named figures and tables from the current page or the whole document using captions, drawing coordinates, continuation evidence and ordered figure legends. Reconstruct supported native text tables as copyable Markdown/TSV. Decorative images and repeated headers are excluded.
- Find **AI 补充识别** inside **图表总览**. Explicitly send chosen page images/text to an image-capable model, then review crops in the same compact workbench. Coordinate formats are normalized; valid neighbors survive invalid candidates. One corrective request can repair unusable page output; actual API errors stop requests.
- Share identity/overlap deduplication between local and AI extraction. Repeated or shifted table crops merge; uncertain replacements require review. Continued tables on different pages remain separate.
- Use select-all and batch figure questions. Extraction, overview, answers and candidate review share a collapsible tabbed workbench; the PDF expanded body stays within 34% of the viewport. Manual tools and AI page options begin folded.
- The first-use current-site permission reminder disappears after consent and returns only when the actual grant is absent. Protected browser/store pages omit it.

## 中文使用说明

更新后重新打开阅读页，确认底部 **v0.8.15**。在设置中保存当前 API；阅读界面只切换该 API 支持的模型，模型下拉框不附带“能力未知”等标签。

PDF 工具栏可切换逐页／连续阅读。底部图表工作台支持本页和全文普通提取；漏提取时进入 **图表总览 → AI 补充识别**，输入页码后识别并核对候选，确认后才加入总览。可全选图表结合正文提问，图片表格可主动调用 AI 转为可复制文本。

支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。

## Validation and limits

0.8.15 passed **121 checks** (110 behavior + 11 build/package), with zero failures. The bare-ID refinement reran the same 27 model-selection checks successfully; these are not added to the total. 0.8.14 passed 241 checks, including ordinary extraction and manually annotated simulated AI responses for three supplied PDFs. Earlier results are historical, not newly rerun counts. See [verification](VERIFICATION.md).

Tests use isolated Edge profiles, generated fixtures and synthetic providers/credentials. They establish software behavior, not live-model accuracy, speed or cost. Extraction is heuristic; scanned body replacement needs external OCR. AI table transcriptions, numbers and generated Python/R code require checking. Code is not executed. File/page/image resource limits remain. There is no layout-preserving translated PDF/DOCX export. Only the final runtime ZIP is for store upload; private sample PDFs and credentials are excluded.
