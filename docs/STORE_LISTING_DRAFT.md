# Edge Add-ons listing draft

## Basic information

- Name: QudadFlow Translator
- Version: 0.4.2
- Category: Productivity
- Listing languages: English (en-US) and Simplified Chinese (zh-CN)
- Support email: lcf1249288484@outlook.com
- Privacy policy URL: https://qudadd.github.io/qudadflow-translator/privacy.html
- Website and support URL: https://qudadd.github.io/qudadflow-translator/
- Pricing: The extension does not provide a translation service. Users provide their own API credentials and are responsible for the provider's fees and terms.

## Short description

Translate webpages with your own Google, DeepL, Microsoft, or compatible API.

## Detailed description

QudadFlow Translator is a Microsoft Edge extension for translating selected text or an entire webpage with a translation service that you configure. It supports Google Cloud Translation v2, DeepL API, Microsoft Translator, OpenAI-compatible Chat Completions, and custom JSON endpoints.

Translate a selection from the popup, the context menu, or a keyboard shortcut. Translate a webpage in a local panel that keeps the original text available for comparison. Immersive translation inserts each translated paragraph below the original paragraph and can restore the page with one click. The panel also supports copying the translated text.

The extension sends text only after you start a translation. API keys, endpoint settings, model settings, and language preferences stay in the browser's extension storage. Requests go directly from the extension to the endpoint you configure; QudadFlow Translator does not operate a proxy, advertising, analytics, telemetry, or remote script service. Translation quality, data retention, and charges depend on the provider you choose. Review the provider's terms and privacy policy before use.

Bring your own API credentials. The current extension interface is in Simplified Chinese.

## Permission justifications

- `activeTab`: Reads the current tab only after the user starts a translation.
- `scripting`: Injects the bundled local content script to read selected/page text and render the translation panel.
- `storage`: Stores the user's endpoint, language settings, model, and API key in Edge extension storage.
- `contextMenus`: Adds a user-invoked “Translate selected text” context-menu command.
- Optional host permissions: Sends requests only to the HTTP(S) endpoint that the user configures and approves; it is not used to collect browsing history.

## Data disclosure draft

- Data processed: Text selected by the user or text extracted after the user starts webpage translation; the API key configured by the user.
- Recipient: The third-party endpoint selected by the user.
- Purpose: Return the translation requested by the user.
- Sale, advertising, and analytics: No sale of data, advertising, behavioral analytics, or telemetry.
- Remote code: No remotely hosted scripts. API responses are processed as text data and are never executed as code.

## Assets and testing screenshots

Upload the generated `branding/qudadflow-store-logo-300.png` as the store logo. Prepare screenshots without real API keys, personal information, or private page content:

1. Popup with language selection and translation actions.
2. Settings page showing a provider configuration with redacted credentials.
3. Translation panel showing original and translated text with the copy action.
4. Immersive translation with translated paragraphs below the originals.

## Version 0.4.2 release notes

Added English and Simplified Chinese manifest metadata, a Chinese setup guide, and a Chinese privacy policy. The product name remains QudadFlow Translator in both locales. The extension interface remains Simplified Chinese.
