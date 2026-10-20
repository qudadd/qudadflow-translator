# QudadFlow Translator 0.4.1 verification

Date: October 20, 2026. Browser: Microsoft Edge 155.0.4283.62.

The repeatable functional suite passed **43 checks, 0 failures**. The machine-readable result is `validation-v0.4.1.json`.

Coverage includes the five provider request and response formats, execution through an Edge extension service worker, selection and immersive translation, restoration of original DOM and link behavior, hidden and editable text exclusion, safe rendering of API text, request deadlines, error handling, provider-specific configuration drafts, stale-result cancellation, long text, popup actions, and context-menu/command registration.

The suite uses synthetic credentials and a local HTTP API. Its isolated extension copy receives a localhost host permission. A separate check of the unmodified production manifest verified that the API request is rejected before optional host access is granted and succeeds after access is granted.

Live Google, DeepL, Microsoft, and other provider accounts, quotas, billing, network accessibility, translation quality, and physical keyboard-shortcut activation were not tested. A user must supply valid credentials for their chosen service.

The screenshots in `branding/screenshots` show the actual extension. Translation screenshots use an explicitly labeled local simulated API with illustrative responses. The settings screenshot shows DeepL configuration with an empty credential field and does not claim a live connection.

The runtime package contains only 14 required files. Developer documents, website files, screenshots, browser profiles, test code, and personal credentials are excluded from the runtime ZIP. The source ZIP uses an explicit file allowlist.

The public website and privacy policy are hosted from `main:/docs` through GitHub Pages:

- https://qudadd.github.io/qudadflow-translator/
- https://qudadd.github.io/qudadflow-translator/privacy.html
