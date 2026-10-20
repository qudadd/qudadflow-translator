# QudadFlow Translator: certification review

The extension has no QudadFlow account or login. Production translation calls a user-configured third-party API directly. Valid provider credentials are needed for live Google Cloud Translation, DeepL, Microsoft Translator, or OpenAI-compatible services. No shared production keys are supplied.

For the 0.5.0 update, Settings includes **启用 MyMemory 基础试用** (enable basic trial). Approve access to api.mymemory.translated.net and try a short English sentence. No key is needed; English → Simplified Chinese is preconfigured. The typical anonymous quota is 5,000 characters/day, with provider retention/usage terms. Source language must be selected manually. This is a public, limited trial, not an unlimited service. Full current review steps and document limitations are in [STORE_UPDATE_0.5.0.md](STORE_UPDATE_0.5.0.md).

For functional review without a paid account, the source repository includes an optional local simulated API. It demonstrates the custom JSON path with the submitted extension's normal settings and optional host permission flow. It is not a translation engine and does not prove live-provider translation quality. It is not bundled in the runtime extension.

## Local manual review

1. Obtain the source from https://github.com/qudadd/qudadflow-translator . With Node.js 18 or newer installed, run `node tools/review-api.cjs` from the repository root. It binds only to `127.0.0.1:8765`, logs no request content, and sends no external requests. Keep it running during review; stop with Ctrl+C.
2. In the submitted extension's settings, choose **自定义 JSON 接口** (Custom JSON). Set the endpoint to `http://127.0.0.1:8765/translate`. Leave API Key empty and custom headers as `{}`. Set request template to `{"text": {{text}}}` and response path to `data.translation`.
3. Click **保存设置** (Save) and allow access to the local API domain. Click **测试连接** (Test connection); a successful result confirms the request completed.
4. Open `http://127.0.0.1:8765/`. Select **Hello world** and use the extension or context menu: the fixture returns **你好，世界**. **Good morning** becomes **早上好** and **Read more** becomes **了解更多**. Other text is echoed. Page and immersive translation preserve the extension's paragraph markers through this deterministic substitution.
5. Test webpage translation, immersive bilingual insertion, copy, and restore from the extension popup. Stop the local API and retry a translation to inspect the failure message.
6. For live-provider review, choose the appropriate provider and supply valid credentials from that provider. Save and approve that API domain before testing. Changing provider maintains separate configuration drafts.

The current interface is Simplified Chinese. English and Simplified Chinese extension metadata and store listings are included. Page text is read only after a user action; API responses are rendered as text, never executed. The runtime contains no remotely hosted JavaScript. Browser internal/protected pages do not permit translation-script injection.

The separate automated suite (`tools/functional-check.cjs`) passed 87 checks for the 0.4.4 development update with a local API in Edge; the submitted 0.4.2 version passed 44 checks. The suite requires Playwright and an isolated test profile; the manual steps above do not require Playwright or modifying the production manifest. Version 0.4.4 has not replaced the 0.4.2 store submission. Its additional site-specific selection opt-in and memory cache are described in `RELEASE_NOTES_0.4.4.md`; they are not features of the submitted 0.4.2 package.
