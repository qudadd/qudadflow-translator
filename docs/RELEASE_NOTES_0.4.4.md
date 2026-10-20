# QudadFlow Translator 0.4.4

October 21, 2026 · Development update. The Edge Add-ons submission remains 0.4.2.

This release focuses on immersive bilingual reading and selection translation.

- Render streamed immersive translations beside their source paragraphs before the whole batch finishes. Prioritize the current viewport, cache computed styles during extraction, and keep progress in a compact panel.
- Preserve separate text runs around nested blocks, spaces between inline spans, line breaks, original links, and the horizontal geometry of ordinary flex/grid cards, lists, and tables. Restore removes the inserted translations without replacing original nodes.
- Add an optional per-site selection button. Select text, click Translate, and read a nearby card that follows scrolling and resizing. Copy, retry, or press Esc to close. Selection alone never sends a request.
- Give selected text the next free request slot ahead of queued page work, while keeping at most two simultaneous requests per page. Closing the selection card cancels only its own request and lets immersive work continue.
- Reuse successful translations from a memory-only cache with a five-minute validity window, at most 128 entries / 250,000 characters. Configuration changes invalidate it; failed and incomplete responses are never cached, and connection tests bypass it.
- Persist per-site opt-in with bundled registered content scripts and optional permissions. Turning it off disables open-page controls and future loading. No mandatory host permission is added.

Validation: 87 local synthetic API and isolated Edge checks passed. A separate smoke check loaded the production manifest and verified permission rejection before an API-domain grant. See `VERIFICATION.md` and `validation-v0.4.4.json` for scope and local timing evidence. These checks do not measure the user's real API.

For an existing unpacked installation, keep its directory, replace the runtime files, reload the extension in Edge, and refresh the webpage. Enable the selection button once for each desired site. The API configuration stays in browser-local storage.

Bilingual paragraphs increase document height. Fixed-height containers, virtualized content, embedded frames, and shadow-root text may need specific adaptation. Immersive actions process up to 80 blocks from a bounded article scan; rerunning after scrolling replaces previous inline translations. The built-in PDF viewer remains unsupported.

## 中文更新说明

沉浸式译文改为在对应原文下方逐步显示，优先处理当前视区；优化嵌套段落、分栏、表格和链接的插入位置。划词翻译增加按站点启用的就近按钮和浮窗，支持复制、重试和 Esc 关闭。

划词请求优先获得下一个空闲请求位置，关闭划词浮窗不会停止沉浸式任务；整个页面仍最多两个并发请求。成功译文可在五分钟内通过内存缓存复用，避免重复调用 API。网站权限与 API 权限分别按需授权，仅选择文字不会发送请求。

本版本为独立试用更新，保留商店审核中的 0.4.2。已通过 87 项本地模拟接口检查，真实 API 的连接、速度和翻译质量仍需实际试用确认。
