# QudadFlow Translator 0.8.14 - Table deduplication and active-API models

October 23, 2026. **Local trial only; wait for user verification before GitHub or store uploads.**

## Changes

AI PDF localisation now receives the current page's existing crop labels and normalized boundaries. Instructions request one complete region per table and exclude duplicate header, row, caption and nested-box detections. These hints do not replace local validation.

Local and AI extraction share a page-scoped duplicate check. Overlapping table candidates, missing or inconsistent labels and small boundary shifts are reconciled before insertion. Conflicting labels are marked for manual review. A larger useful crop can replace the existing item only after explicit confirmation; its earlier analysis/code drafts are then cleared. Repeating AI extraction or running ordinary extraction afterward does not add the same table again. Adjacent tables and genuine same-number continuations on different pages are preserved. This concerns duplicate table regions, not removing repeated data rows from a scientific table. Detection remains heuristic, and uncertain crops require source checking.

API configuration changes are now confined to **Settings**. The popup, document reader and paper/figure workbench expose **model selectors for the active API**, and the backend rejects the former alternate-profile route. Traditional translation providers remain available for body text. AI figure work requires the active API and selected model to support images; it cannot silently use another saved API.

Settings' **读取上游模型** explicitly fetches the same-origin models endpoint with the configured credentials. Detailed metadata remains in that settings tab; compact model IDs and recognized input/output types persist locally for reading-page selectors. Catalogs are separated by a connection digest that covers provider, address, key and headers. They retain a fetch timestamp, hold at most 1,000 models per connection, 20 connections and 2 MB total, and evict the oldest catalogs when full. Credentials are not copied into catalog records. If headers reference the model placeholder, catalog matching also follows that model-dependent connection. Catalogs do not expire automatically; refresh in Settings when upstream offerings change.

Discovery never picks a model or activates an unsaved draft. A current manually entered model remains usable even when absent from the returned list. Page selectors accept only models returned for the current connection; unsupported discovery still allows manual entry in Settings. Capability labels follow upstream metadata, and missing information is shown as unknown. Listing a model does not establish availability, price or vision quality.

Selecting a model changes only the shared active model and that saved scheme's default model. It synchronizes open extension views, cancels pending work and invalidates results/cache that belong to the previous configuration. Controls wait for selection to commit before a new request can start. API addresses, keys and header templates remain the Settings choice. Stale selectors and stale settings forms cannot overwrite a newer connection/model choice. Loading cached lists performs no upstream request.

## Validation

The three supplied PDFs were rechecked through ordinary extraction and AI confirmation/rerun flows using actual local page pixels and manually annotated simulated responses. Dedicated cases cover duplicate/unnamed/misnumbered tables, same-page containment, shifted reruns, explicit replacement, adjacent tables and cross-page continuations. AI localisation still resides in **图表总览**.

Model tests cover real extension messaging between isolated popup, reader, research and settings pages; actual simulated document/question request bodies; credential/header isolation; catalog persistence/capacity; API-switch rejection; stale selections; pending-request cancellation; selection-commit locking; failed discovery; and narrow layouts. Regression checks also cover document navigation, paper questions, tables, Skills, memory and website permissions. Build and archive checks are recorded in [VERIFICATION.md](VERIFICATION.md).

All provider responses and credentials are synthetic. These results establish software behavior, not real-model accuracy, latency or universal extraction coverage. No actual browser profile or API key was read. Private PDFs, annotations and screenshots remain outside repository/package inventories. Some source figure plates are already clipped by their PDF boundary; extraction cannot restore absent source pixels.

## 中文试用步骤

1. 在 `edge://extensions` 重新加载 QudadFlow Translator，关闭旧文档和论文窗口后重新打开，确认底部 **v0.8.14**。本地目录更新不会自动激活新版。
2. 进入 **API 与翻译设置**，选择需要使用的 API 方案并保存。OpenAI 兼容接口点击 **读取上游模型**；读取成功后，列表会按连接在本地保存，无需在每个页面重复读取。
3. 在扩展弹窗、文档顶部或论文／图表工作台选择模型。这里只切换模型；其他窗口同步使用此选择。需要换 API、Key 或端点时回到设置。现有手填模型保留，未读取列表时先在设置读取；没有标准模型接口的服务可继续手填。
4. PDF 先做普通全文提取，再在 **图表总览 → AI 补充识别** 选择相关页码并预览。反复识别同页应保留一份对应表格；更完整范围需明确替换，重叠编号冲突需核对。跨页续表继续分段显示。
5. 图片表格的可复制内容仍需显式 AI 转写，并对照原始数值检查。真实识别效果由你配置的模型试用确认。

支持邮箱：lcf1249288484@outlook.com · QQ 交流群：1048123205。
