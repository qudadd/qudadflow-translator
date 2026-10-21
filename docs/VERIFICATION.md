# QudadFlow Translator 0.7.0 verification

Date: October 21, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **169 checks passed, zero failures:** 87 webpage/provider + 34 documents + 13 configurations + 17 layout/figures + 18 research.

All five suites use isolated Edge profiles, generated papers/images/documents, synthetic credentials and local simulated APIs. No private user settings or live provider account was accessed. The research suite grants all-host access to its disposable test copy solely to exercise viewport capture; the production manifest keeps optional host permissions. Real-provider speed, availability, cost, model accuracy and generated-code correctness are not established by these tests.

Research checks cover explicit webpage extraction, raster/SVG/offscreen images, safe streamed text, Skill import/export and stale edits, memory off by default, cross-page recall and notebook isolation, JSON/Markdown exports, pending-operation deletion/cancellation, memory caps/expiry and browser-restart persistence, and visible storage failure without losing a successful analysis. Python and R drafts download separately and remain inert text. PDF full-document analysis and original-page attribution after navigation are verified; DOCX/TXT/Markdown use the same workflow. Existing TXT parsing/analysis paths use the common text reader.

Reports: validation-v0.7.0.json, validation-documents-v0.7.0.json, validation-configuration-v0.7.0.json, validation-layout-v0.7.0.json and validation-research-v0.7.0.json. Run the corresponding tools/*-check.cjs scripts to reproduce. UI screenshots were inspected for both webpage and PDF research panels. Known limits: heuristic extraction, 60,000-character paper input, bounded image resolution, no built-in scan-body OCR, no layout-preserving PDF/DOCX export, and no code execution.

## Previous: QudadFlow Translator 0.6.0 verification

Date: October 21, 2026 (Asia/Shanghai). Browser: Microsoft Edge 155.0.4283.62.

**151 checks passed, zero failures:** 87 webpage/provider, 34 document, 13 configuration/basic-provider and 17 layout/figure checks. Reports: [webpage/provider](validation-v0.6.0.json), [documents](validation-documents-v0.6.0.json), [configuration](validation-configuration-v0.6.0.json), [layout/figures](validation-layout-v0.6.0.json).

All tests use generated files, synthetic credentials, localhost APIs and isolated Edge profiles. No real user API configuration or private key was accessed. No live provider request was made for this release; real latency, quotas and translation/vision quality remain unverified. The earlier live MyMemory sample below belongs to 0.5.0.

New verified behavior:

- PDF page ratio, replacement positions and rotated-page resize; exact pixel equality for raster images and vector charts outside text regions. Source glyphs disappear only for fitted translations. Oversized fallback regions retain original canvas pixels with a full-text link. Translation while showing the original keeps valid geometry.
- Word page dimensions, margins, tables and raster image positions, with matching heading font size/weight. Generated DOCX files lacking package relationships render. XML/external-resource guards and bounded ZIP parsing remain covered.
- TXT/Markdown paragraph positions, original content before translation, retained original text on overflow and full-text inspection.
- Local image extraction and duplicate prevention without API calls; PDF vector crop and image download; explicit bounded image upload with Chat Completions or Responses. Traditional body translation works alongside a separate saved vision AI configuration.
- Streamed analysis, cancellation, unsupported vision errors, configuration changes during a stream, document replacement and stale-output cleanup. Reader-only requests reject invalid images and unauthorized extension pages. Profile summaries contain no keys or endpoints. No unexpected document network loads or page errors were observed.

Important limits: Word uses browser layout and can differ from Microsoft Word. Arbitrary overlaps, equations, font encodings, complex columns and clipping are not fully covered; use paragraph comparison when needed. Scanned-page body replacement requires external OCR. AI image analysis does not rewrite chart artwork. Export remains bilingual TXT, with no layout-preserving PDF/DOCX export. Generated tests do not establish universal document fidelity or official store certification.

The 0.6.0 package is a development preview, not an Edge Add-ons submission. Version 0.5.0 was last confirmed In review on October 21; its review and historical package are preserved. Updating unpacked runtime files requires an Edge extension reload to activate; file copying alone is not evidence of activation.

## Previous 0.5.0 verification

Date: October 21, 2026 (Asia/Shanghai). Browser: Microsoft Edge 155.0.4283.62.

The 0.5.0 runtime package passed Partner Center package validation and was submitted to Microsoft Edge Add-ons on October 21, 2026 (Asia/Shanghai). The overview confirmed **Version 0.5.0 — In review**, with English and Chinese (China) listings. Submission evidence and the exact package SHA256 are in [STORE_SUBMISSION_0.5.0.md](STORE_SUBMISSION_0.5.0.md). This confirms submission, not store approval.

Version 0.5.0 passed **134 checks, 0 failures**: 87 webpage/provider checks, 34 document checks, and 13 saved-configuration/basic-provider checks. Machine-readable reports: `validation-v0.5.0.json` and `validation-documents-v0.5.0.json`. The tests use generated documents, local HTTP fixtures, synthetic credentials, and fresh isolated browser profiles. They do not access the user's extension settings or call a live provider.

Saved-configuration checks cover migration of an existing connection, named copies, reload/edit/apply, metadata without credentials, stale-tab conflict rejection, popup switching, trial activation without destroying saved keys, duplicate prevention, and deletion of an active configuration. MyMemory tests verify single-paragraph requests below 500 UTF-8 bytes, local marker preservation, absence of key/custom headers, entity decoding, source-language and quota errors, cancellation, and configuration changes during page translation. Report: `validation-configuration-v0.5.0.json`.

A separate live MyMemory check used an isolated extension profile and only the fixed sentence “Hello world. This is a translation test.” It returned Chinese text in 1,881 ms. This was an anonymous public API request, without any user key. It does not measure sustained availability, quotas, long-document latency, or translation quality. Other live provider connections remain unverified. To explicitly repeat this live check, set `QF_LIVE_TRIAL=1` when running `tools/configuration-check.cjs`; the default suite is local-only.

Document coverage includes:

- The unchanged production manifest renders a real local PDF canvas and selectable text layer with no host grants. All parser code, fonts, character maps, and codecs are bundled. PDF.js legacy targets Chromium 125+; this suite runs on Edge 155.
- Multi-page PDF, single/two-column extraction, declared page rotation, navigation back to completed translations, and a page without extractable text that displays OCR guidance and sends no translation request.
- DOCX headings, body/table-cell text, Unicode, hidden/deleted text exclusion, explicit visible-run handling, malformed ZIP/XML and entity-declaration rejection, and bounded document-XML decompression.
- UTF-8/UTF-16 text, safe surrogate splitting, TXT/Markdown import, literal rendering of document/provider HTML, and no unexpected external document resource requests.
- Streamed text before completion, marker preservation and bounded per-paragraph fallback, two-request concurrency, stop/resume, configuration invalidation, replacement during a stream, and independent cancellation when a reader closes. A third concurrent port request is rejected.
- Equal paragraph heights, synchronized scrolling, resizing, bilingual TXT export, file/text/page limits, source-URL prefill, attachment filenames, download errors, download cancellation/replacement, popup document entry, and context-menu registration. Permission denial uses an isolated test stub; the actual source-download path uses a localhost grant in the test copy.

The new reader retains original PDF page appearance alongside ordered translated text. It does not promise geometric paragraph matching for arbitrary PDFs or generate a layout-preserving translated PDF/DOCX. DOCX is a text-reading view, without Word image/table layout, headers, footers, or original pagination. Scanned-image OCR, unusual PDF encodings, arbitrary multi-column layouts, real authenticated source websites, encrypted-PDF password flow, and live-provider behavior were not verified by this suite.

The runtime ZIP now includes the document reader, local parsing libraries, and their licenses. Development tests and website documents remain in the separate source ZIP. The previously submitted 0.4.2 package is preserved. Reload an updated unpacked installation in Edge to activate the new runtime; the file update does not access browser-local API settings.

## Previous 0.4.4 verification

Date: October 21, 2026 (Asia/Shanghai). Browser: Microsoft Edge 155.0.4283.62.

Version 0.4.4 passed **87 functional checks, 0 failures**. The machine-readable result is `validation-v0.4.4.json`. All provider credentials and responses are synthetic. The suite uses a local HTTP server and a fresh isolated Edge profile; it never reads the user's browser settings.

New coverage verifies:

- Natural-flow insertion for nested text runs, preserved spaces and line breaks, unchanged horizontal positions and widths of ordinary flex/grid cards, lists and table cells, original DOM restoration, and working links.
- Partial immersive text before a streaming batch finishes, cleanup after an interrupted stream, viewport priority on a 150-paragraph page, the 80-block limit, and cached repeat actions without extra HTTP calls.
- Site opt-in, no request from selection alone, nearby results, duplicate-click suppression, copy errors, retries, Esc cancellation, editable/opt-out exclusions, viewport bounds after scrolling/resizing, and registered-script persistence/disable across pages.
- Selection priority ahead of queued page work, successful selection reading and cancellation without stopping immersive translation, and the shared two-request concurrency limit.
- Cache hits, settings/model/credential/language/context changes, permission checks before cache lookup, expiration, connection-test bypass, and rejection of failed or incomplete responses.

The local delayed fixture produced the following observations, recorded in the JSON report:

| Scenario | Observation | Meaning |
| --- | --- | --- |
| First translation with a 200 ms server delay | 223 ms | Synthetic local request, not a remote model |
| Repeat of the same successful text/configuration | 0 ms at the test clock's millisecond resolution | Cache hit; zero additional HTTP requests |
| Immersive first visible text | 51 ms | Text appeared before completion |
| Same streaming batch complete | 280 ms | Fixture deliberately delayed the remainder by 220 ms |

These observations establish incremental display and avoided repeat requests. They are not live-provider latency measurements or speedup guarantees. Real endpoint/model configuration, credentials, gateway accessibility, billing, translation quality, and physical keyboard-shortcut activation remain unverified.

The integration copy has a test-only localhost host grant. A separate fresh-profile smoke check loads the **unchanged production manifest**, confirms no mandatory host permissions, checks `PERMISSION_REQUIRED` before an API-domain grant, and verifies default streaming with an empty credential field. Manifest, local JavaScript syntax, packaged resources, icons, and matching English privacy-policy copies were also checked.

The runtime ZIP contains only the 16 extension files. A separate source ZIP contains development documents and tests. This update does not replace the submitted 0.4.2 store package. Existing unpacked installs need an extension reload and webpage refresh after the files are updated. Browser-local API settings are retained.

Bilingual text naturally increases paragraph height. Fixed-height, virtualized, iframe, or shadow-root layouts are not fully covered. The bounded article scan and 80-block action limit are documented. Direct translation inside Edge's built-in PDF viewer is not implemented.

## Previous 0.4.3 verification

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
