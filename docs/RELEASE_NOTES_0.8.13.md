# QudadFlow Translator 0.8.13 - PDF extraction and AI crop recovery

October 23, 2026. **Local trial only. Wait for the user's verification before GitHub, Edge or Chrome uploads.**

## Changes

The previous parser assumed a narrow coordinate format and could reject a whole response when one crop was invalid. This release validates candidates individually and retains usable results. The user's exact upstream response was not captured; these changes address the reported failure class rather than asserting a particular model response.

AI localisation now requests an explicit normalized-1000 `xywh` schema, image dimensions and bounds equations. Declared 0-1 fractions, percentages, pixels and corner coordinates are also converted. Unmarked fractions are identified with a preview note; unmarked corner coordinates are inferred only when extents are impossible and the corner interpretation is valid, then start unchecked. Minor edge rounding is clamped with a note. Negative, nonnumeric, unknown-unit and whole-page ranges are rejected. Near-whole-page crops require manual selection. A bad candidate no longer removes valid neighbors.

A selected page with unusable JSON or geometry and no usable candidates gets at most one format-correction request using the same image and page text. After another unusable response, the report records that page and proceeds to the next selected page. Partially valid responses retain their good candidates without an automatic retry. Actual API/HTTP or network failures stop subsequent requests immediately; successful earlier candidates still receive explicit preview confirmation. There is no API countdown. Stop, document replacement and configuration changes cancel pending work and stale previews. **重试问题页** explicitly reruns only affected pages; report details stay collapsed by default. Retry costs and model behavior follow the selected provider.

**AI 补充识别 now belongs to 图表总览**, collapsed beside the extracted material. Webpage supplementation controls are also in the gallery. Whole-document local extraction leads to the gallery even when no results are found. Accepting or cancelling candidate review returns there. The bounded, nonmodal PDF workbench and one-action all-figure questions remain available.

Ordinary PDF extraction can connect an explicitly headed, complete, ordered main-figure legend list to an exact sequence of contiguous later graphics pages. Missing counts, interrupted sequences and already assigned identities prevent speculative matching. The source legend page and an order-check reminder accompany these results. Vector and raster figure plates are supported. Native table reconstruction now excludes rotated watermark text, and continued tables do not prepend a header that is already printed. Local extraction does not call AI.

## Verification and limits

Three supplied PDFs were processed locally: the 46-page reference yields five main figures and four Table 1 segments; the 10-page paper yields four figures and one 24-row, six-column table; the 42-page manuscript yields 17 figure/table segments, including its ten-page Table 1. Detached-legend checks also cover incomplete, interrupted and ambiguous sequences that must remain unmatched.

AI tests use actual page pixels with manually annotated simulated responses, plus malformed-coordinate, partial-result, HTTP-error and cancellation fixtures. They verify conversion, correction, sequencing, review and insertion, **not real-model recognition accuracy or provider speed**. No real user profile, API credentials or provider was accessed. Private PDFs, annotations, crops and screenshots stay outside repository/package inventories. See [verification reports](VERIFICATION.md).

Extraction remains heuristic. Section-numbered unruled supplementary tables in the 42-page manuscript can still need AI or manual selection. Some figure plates in the 46-page source are already clipped at the PDF page boundary; invisible source content cannot be recovered. Local reconstructed tables and AI transcriptions must be checked against the original.

## 中文本地试用

1. 在 `edge://extensions` 重新加载现有 QudadFlow Translator，关闭旧 PDF 阅读器和问答窗口，再重新打开文档，确认底部 **v0.8.13**。复制文件不会自动激活新版。
2. 展开底部 **图表工作台 → 提取图表**，点击 **提取全文图表**，在自动打开的 **图表总览** 检查编号、跨页分段和可复制表格。普通提取不调用 API。
3. 有遗漏时，在 **图表总览 → AI 补充识别** 选择支持图片的配置。先填少量相关页码，或留空仅识别当前页，再点击 **识别并预览**。该动作会发送所选页面图片和文字；格式不可用时可能对同一页再发送一次。
4. 在 **核对候选** 对照原页，检查裁剪边界与编号。不确定、接近整页或替换旧裁剪的候选需手动勾选；确认后才加入。某页失败不应丢掉已成功的候选。报告中查看原因，必要时点击 **重试问题页**。
5. 图片表格可继续用 **提取可复制表格**，并核查原始数字。使用 **全选并提问** 或 **全选图表并提问** 纳入材料，点击发送后才进行问答。

真实 AI 效果等待用户使用已配置模型验证；本版未上传平台。支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。
