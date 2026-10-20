# QudadFlow Translator

A Manifest V3 extension for Microsoft Edge, focused on immersive bilingual reading and selection translation. Place translations beneath their source paragraphs, or translate a selected phrase in a nearby floating card.

[Website](https://qudadd.github.io/qudadflow-translator/) · [Privacy policy](https://qudadd.github.io/qudadflow-translator/privacy.html) · [中文网站指南](https://qudadd.github.io/qudadflow-translator/zh-CN.html) · [中文 README](README.zh-CN.md)

## Translation providers

- Google Cloud Translation v2
- DeepL API (Free and Pro endpoints)
- Microsoft Translator (Azure)
- OpenAI-compatible Chat Completions and Responses, including streamed text
- Custom JSON APIs with request templates and response paths

Bring your own API credentials. Provider accounts, charges, availability, retention policies, and translation quality depend on the provider you choose. The extension does not include a translation subscription or developer-operated proxy. The current extension interface is in Simplified Chinese.

## Install for development

1. Open `edge://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository folder.
3. Open the extension options, select your provider, enter the endpoint and API key, and save.
4. Allow access to the API domain and use **Test connection**.
5. Open a normal webpage and choose **沉浸式翻译当前网页** (immersive translation).
6. For the nearby selection button, enable **在此网站启用划词翻译按钮** in the popup and approve access to that site. Select text, then click **翻译**. Press Esc to close. This opt-in persists for that site; selecting alone never sends text.

Browser-internal pages, the built-in PDF viewer, and restricted store pages cannot be translated. Page-panel extraction is limited to 12,000 characters per action; immersive translation processes up to 80 text blocks. These limits are shown in the extension interface.

For OpenAI-compatible services, enter a full `/v1/chat/completions` or `/v1/responses` endpoint and a model supported by that service. A domain or `/v1` base URL defaults to Chat Completions. Streaming is enabled by default; turn it off if your gateway does not support it. Leave Temperature empty to use the provider default. A rejected temperature parameter is removed for one retry only. The request timeout defaults to 45 seconds and can be set to 10–180 seconds.

Version 0.4.4 streams immersive text into its paragraph while the response arrives, prioritizes blocks near the viewport, and uses a compact progress panel. Nested text, links, lists, and ordinary grid/flex cards retain their source containers. Bilingual text increases paragraph height; fixed-height layouts, virtualized pages, embedded frames, and shadow-root content can still need site-specific adaptation. An action processes up to 80 blocks from a bounded scan of the main article. Scroll and run it again for another part of a long page; doing so replaces the previous inline translation.

The selection card follows its selected passage while scrolling or resizing. Its request gets the next free slot ahead of queued page work, with a shared limit of two active requests per page. Closing the card cancels only its own request, so immersive translation can continue. Duplicate in-flight commands are suppressed, and completed translations remain visible if a later page batch fails.

Successful repeated translations can be reused from a bounded memory cache for five minutes, avoiding another API call. Configuration changes and worker shutdown clear the cache; connection tests always reach the provider. Actual provider latency and quality still depend on the configured API and model. After updating an unpacked installation, reload the extension and refresh the webpage; browser-local settings are retained.

## Privacy

Translation starts after a user action. Requests go directly to the configured endpoint. Settings and API keys use browser-local extension storage. The extension contains no advertising, analytics, telemetry, or remote executable code. Optional host access is requested separately for your API domain and each site where you enable the selection button. The per-site setting registers bundled UI code for later visits, without automatically translating or sending text. Site matching covers the selected HTTP(S) scheme and host on all ports. Turning the switch off disables the UI and unregisters future loading; revoke retained site access separately through Edge if desired.

The service worker holds recent source text and results only in memory (at most 128 entries / 250,000 characters, five-minute reuse window), never in persistent translation history. See the policy for details.

See the [full privacy policy](https://qudadd.github.io/qudadflow-translator/privacy.html). For support and privacy questions: **lcf1249288484@outlook.com**.

## Build

Requires Node.js and PowerShell. No runtime dependencies or bundler are needed.

```powershell
.\package.ps1 -OutputDirectory .\dist
```

The script validates the manifest, local scripts, and icons, then creates a runtime ZIP and a separate source ZIP. Upload the runtime ZIP to Edge Add-ons. Never include your API keys in a package or commit.

## Verification

```powershell
npm install --no-save playwright
node tools/functional-check.cjs functional-results.json
```

The functional suite uses synthetic credentials, a local HTTP fixture, and an isolated Microsoft Edge profile. The test copy receives a localhost permission; the production manifest keeps optional host permissions. Version 0.4.4 passed 87 checks on Edge 155.0.4283.62, including layout geometry, selection interactions, site opt-in, streaming, caching, cancellation, and shared concurrency. A separate smoke check loads the unchanged production manifest. This verifies API request formats and extension behavior; live provider credentials, account billing, translation quality, and physical keyboard-shortcut activation were not tested. See [verification details](docs/VERIFICATION.md).

## Publishing

Version 0.4.2 was submitted to Edge Add-ons and showed **In review** on October 20, 2026. Version 0.4.4 is a separate development update; it has not replaced that submission. The repository and website do not imply store approval. English and Simplified Chinese metadata keep the same QudadFlow Translator name. Submission materials are in `docs/STORE_LISTING_DRAFT.md`, `docs/STORE_LISTING.zh-CN.md`, and `docs/STORE_SUBMISSION.md`.
