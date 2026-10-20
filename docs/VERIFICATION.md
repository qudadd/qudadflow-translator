# QudadFlow Translator 0.4.3 verification

Date: October 20, 2026. Browser: Microsoft Edge 155.0.4283.62.

Version 0.4.3 passed **68 functional checks, 0 failures**. The machine-readable result is `validation-v0.4.3.json`. All credentials and provider responses in this suite are synthetic; tests use a local HTTP server and an isolated Edge profile.

New coverage includes explicit Responses requests (`input`, `instructions`, `store: false`), Chat Completions content arrays, trailing endpoint slashes, streamed text from both protocols, split UTF-8 and CR/LF handling, reasoning exclusion, JSON responses to stream requests, one retry for an unsupported temperature parameter, truncated output, non-JSON responses, stream errors and deadlines, and HTTP cancellation isolated by sender.

Real Edge integration checks verify that streamed selection text appears before completion, immersive translations appear batch by batch, page requests run with at most two concurrent requests and preserve order, repeated marker failures stop with a bounded fallback, completed inline translations survive a later failure, duplicate commands share their request, and option controls stay disabled while a connection test runs. Existing checks for all five connectors, text-only rendering, exclusion of hidden/editable content, restoration, popup actions, and command registration remain included.

The integration suite gives only its test extension copy a localhost host permission. A separate fresh-profile smoke check loaded the unmodified 0.4.3 production manifest, verified that it has no mandatory host permissions, and confirmed `PERMISSION_REQUIRED` before an API-domain grant. That smoke check also verified the default streaming checkbox and captured the new options interface with an empty credential field. The existing 0.4.2 optional-permission grant check is recorded below.

No real provider request or user's extension settings were accessed by these tests. Live credentials, gateway availability, billing, translation quality, and physical keyboard-shortcut activation remain unverified. These results do not identify the cause of an individual user's API failure or establish live-provider latency.

The new development update does not replace the 0.4.2 package currently submitted to Edge Add-ons. To use updated files in an existing unpacked installation, reload the extension in Edge and refresh the webpage; local settings are retained. Direct translation inside Edge's built-in PDF viewer is not implemented.

## Previous 0.4.2 verification and store submission

Date: October 20, 2026. Browser: Microsoft Edge 155.0.4283.62.

The repeatable functional suite passed **44 checks, 0 failures**. The machine-readable result is `validation-v0.4.2.json`.

Coverage includes the five provider request and response formats, execution through an Edge extension service worker, selection and immersive translation, restoration of original DOM and link behavior, hidden and editable text exclusion, safe rendering of API text, request deadlines, error handling, provider-specific configuration drafts, stale-result cancellation, long text, popup actions, and context-menu/command registration.

The suite uses synthetic credentials and a local HTTP API. Its isolated extension copy receives a localhost host permission. A separate check of the unmodified production manifest verified that the API request is rejected before optional host access is granted and succeeds after access is granted.

Live Google, DeepL, Microsoft, and other provider accounts, quotas, billing, network accessibility, translation quality, and physical keyboard-shortcut activation were not tested. A user must supply valid credentials for their chosen service.

Localized manifest metadata was resolved by the real Edge extension runtime, retaining the English product name. Both English and Simplified Chinese catalogs are included in the production package.

The screenshots in `branding/screenshots` show the actual extension interface from version 0.4.1; version 0.4.2 changes localization metadata and documentation without changing these controls. Translation screenshots use an explicitly labeled local simulated API with illustrative responses. The settings screenshot shows DeepL configuration with an empty credential field and does not claim a live connection.

The runtime package contains only 16 required files. Developer documents, website files, screenshots, browser profiles, test code, and personal credentials are excluded from the runtime ZIP. The source ZIP uses an explicit file allowlist.

Version 0.4.2 was installed and enabled in the user's existing Edge profile for manual trial. The same runtime ZIP was submitted to Microsoft Edge Add-ons; Partner Center showed **In review** on October 20, 2026 at 11:02 UTC. This is a submission confirmation, not store approval. Both English and Chinese (China) listings are included.

Certification instructions in `REVIEWER_GUIDE.md` provide an optional local-only simulated API (`tools/review-api.cjs`) that requires Node.js but no provider key or Playwright. Its sample page, translation response with preserved paragraph marker, and invalid-input response were checked separately. It is excluded from the runtime ZIP and does not demonstrate live-provider translation quality.

The public website and privacy policy are hosted from `main:/docs` through GitHub Pages:

- https://qudadd.github.io/qudadflow-translator/
- https://qudadd.github.io/qudadflow-translator/privacy.html
- https://qudadd.github.io/qudadflow-translator/zh-CN.html
- https://qudadd.github.io/qudadflow-translator/privacy.zh-CN.html
