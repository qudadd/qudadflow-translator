# QudadFlow Translator

A Manifest V3 extension for Microsoft Edge. Translate a selection, read a page in a translation panel, or insert translations beneath the original paragraphs.

[Website](https://qudadd.github.io/qudadflow-translator/) · [Privacy policy](https://qudadd.github.io/qudadflow-translator/privacy.html) · [中文网站指南](https://qudadd.github.io/qudadflow-translator/zh-CN.html) · [中文 README](README.zh-CN.md)

## Translation providers

- Google Cloud Translation v2
- DeepL API (Free and Pro endpoints)
- Microsoft Translator (Azure)
- OpenAI-compatible Chat Completions
- Custom JSON APIs with request templates and response paths

Bring your own API credentials. Provider accounts, charges, availability, retention policies, and translation quality depend on the provider you choose. The extension does not include a translation subscription or developer-operated proxy. The current extension interface is in Simplified Chinese.

## Install for development

1. Open `edge://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository folder.
3. Open the extension options, select your provider, enter the endpoint and API key, and save.
4. Allow access to the API domain and use **Test connection**.
5. Open a normal webpage and use the extension popup or context menu.

Browser-internal pages and restricted store pages cannot be translated. Page-panel extraction is limited to 12,000 characters per request; immersive translation processes up to 80 text blocks. These limits are shown in the extension interface.

## Privacy

Translation starts after a user action. Requests go directly to the configured endpoint. Settings and API keys use browser-local extension storage. The extension contains no advertising, analytics, telemetry, or remote executable code. Optional host access is requested for the API domain you configure.

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

The functional suite uses synthetic credentials, a local HTTP fixture, and an isolated Microsoft Edge profile. The test copy receives a localhost permission; the production manifest keeps optional host permissions. Version 0.4.2 passed 44 checks on Edge 155.0.4283.62. This verifies API request formats and extension behavior; live provider credentials, account billing, translation quality, and physical keyboard-shortcut activation were not tested.

## Publishing

The extension is being prepared for Edge Add-ons review. The repository and website do not imply store approval. English and Simplified Chinese metadata keep the same QudadFlow Translator name. Submission materials are in `docs/STORE_LISTING_DRAFT.md`, `docs/STORE_LISTING.zh-CN.md`, and `docs/STORE_SUBMISSION.md`.
