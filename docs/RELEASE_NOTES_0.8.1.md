# QudadFlow Translator 0.8.1 — Edge trial

Prepared October 21, 2026. This local trial combines the table/visual-capture improvements with rendering, storage and build updates. Publication to GitHub, Edge Add-ons and Chrome Web Store awaits the user's testing decision.

## Paper tables and visual evidence

- HTML and ARIA tables have independent expandable cards, including tables outside the main article container. Captions, footnotes, row/column spans and data enter paper Q&A; responsive duplicates are removed. Tables remain available with the source text collapsed.
- Generic article/main/articleBody and plain-body extraction handles later papers as fresh captures. It preserves full extracted body text and inventories lazy images, sibling figures, SVG/canvas charts and image tables. Run capture again after navigating to another paper.
- For missed visual content, use **补充识别当前视区图表**, or import/paste PNG, JPEG or WebP screenshots. Both webpage research and the document reader support screenshot import. Previews remain local until an explicit analysis action; vision prompts ask for table transcription, original values/units/footnotes and uncertainty labels.
- One requested viewport screenshot can coexist with all 100 ordinary figure candidates. The screenshot no longer silently displaces the final candidate. Existing image and table resource limits remain visible.

## Rendering and storage

- Paper answers, figure analysis and Python/R drafts share a streamed Markdown renderer. It combines incoming fragments over 150 ms, avoids rebuilding identical output, and renders the final or stopped text immediately.
- Resetting a conversation or replacing its source clears pending rendering; late fragments cannot replace the new task's output.
- Loading one remote figure now reads only its source metadata from the stored capture, without converting every cached image Blob back to base64. Existing Blob storage, capture expiry and notebook retention remain in place.
- These changes reduce local rendering and conversion work. They do not establish a speedup or accuracy improvement for a remote AI provider.

## Build and verification

- A shared runtime/source inventory drives staging, dependency validation and archive auditing. It rejects unsafe/private paths and symbolic links, and includes new source modules automatically.
- Package validation checks 249 runtime files, 20 first-party scripts, local references, manifest metadata, icons and matching English privacy copies. The staged runtime is checked before ZIP creation.
- Every archive entry and byte is compared against the inventory and working source. A successful build emits runtime/source ZIPs, an audit JSON and SHA256 checksums. Failed validation preserves existing output packages and cleans staging files.
- Sorted ZIP entries and fixed timestamps make unchanged inputs reproducible in the same Node/PowerShell/.NET environment. The implementation sets entry metadata before writing bytes, including on Windows PowerShell's .NET runtime.

**240 checks passed, zero failures:** 229 across eight isolated Edge suites and 11 build checks. The build suite uses disposable source copies to test repeated builds, broken dependencies, syntax errors, remote imports, missing codecs, private paths, archive alterations and privacy-policy mismatch. The vision suite checks rendering coalescing, cancellation, figure/code streams, candidate retention and metadata-only reads. See [verification details and reports](VERIFICATION.md).

The saved public Ovid paper yields four unique figures and four independent table cards. Its copyrighted HTML remains outside the repository and packages; the report retains table metadata and character counts. Wide/narrow table screenshots and narrow image-import controls were visually inspected. Browser suites use synthetic keys, generated documents, local simulated APIs and isolated Edge profiles. No real user API configuration or live AI was accessed. Chrome integration is not newly verified.

## Trial activation and limits

Keep the existing unpacked extension and its directory. Save/export unfinished research first, reload QudadFlow Translator at `edge://extensions`, confirm **0.8.1**, then refresh the paper webpage and run capture again. Old capture windows keep their old material; they do not gain newly detected tables automatically. Reloading an in-place update retains browser-local API settings.

Automated checks validate an isolated Edge installation. They do not establish activation in the user's browser. The computer-control tool previously stopped because it could not reliably determine the browser URL, so the user's reload remains manual.

Extraction is heuristic, with screenshot input as a fallback. Protected frames/images, inaccessible content and external supplements may require manual input; scanned PDF body replacement needs OCR. Vision transcription must be checked against the source. Provider context/request limits and browser resources still apply to long papers. Generated Python/R remains an unexecuted draft, and translated PDF/DOCX export does not preserve original layout.

## 中文试用说明

0.8.1 完成了通用图表与表格识别后的整体构建优化。网页表格独立列出，正文收起后仍可查看；图片形式或特殊布局的表格，可通过 **补充识别当前视区图表**，或在网页/文档分析中导入、粘贴截图，交给支持图片的 AI 分析。先核对预览，再主动发送分析；不保证所有网站均能自动准确识别。

论文回答、图表解释及 Python/R 草稿共用合并刷新的 Markdown 渲染器；结束或停止时立即显示剩余内容。载入单张原图不再重复解码整份图片缓存。构建统一清单、依赖/语法检查及逐文件 ZIP 校验，自动生成校验报告和 SHA256；相同源码在相同运行环境下可重复得到一致安装包。

本版共 **240 项检查通过，0 失败**。这些结果验证本地功能与构建行为，不代表真实服务商速度或 AI 识别准确率。安装文件更新后，请在 `edge://extensions` 对原来的 QudadFlow Translator 点击 **重新加载**，确认 **0.8.1**，刷新论文并重新提取。保留原安装和侧载目录，可保留 API 配置。尚未发布 GitHub 或商店，待你试用后决定。

支持邮箱：lcf1249288484@outlook.com；QQ 交流群：1048123205。
