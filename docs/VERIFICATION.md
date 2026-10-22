# QudadFlow Translator 0.8.7 verification

October 22, 2026 (Asia/Shanghai), Microsoft Edge 155.0.4283.62. **342 checks passed, zero failures: 331 behavior checks and 11 build/package checks**, with every suite below rerun for 0.8.7.

| Suite | Passed | Report |
| --- | ---: | --- |
| Webpage/providers, colors and configurable shortcut | 125 | [report](validation-v0.8.7.json) |
| Saved configurations and optional permissions | 14 | [report](validation-configuration-v0.8.7.json) |
| Paper companion and select-all | 25 | [report](validation-companion-v0.8.7.json) |
| Document layout and colors | 20 | [report](validation-layout-v0.8.7.json) |
| Research, Skills and memory | 19 | [report](validation-research-v0.8.7.json) |
| PDF/DOCX/TXT/Markdown reader | 34 | [report](validation-documents-v0.8.7.json) |
| Publisher captions and original images | 13 | [report](validation-publisher-v0.8.7.json) |
| Upstream model discovery | 23 | [report](validation-models-v0.8.7.json) |
| Visual supplementation and storage | 25 | [report](validation-vision-v0.8.7.json) |
| Copyable tables | 22 | [report](validation-table-export-v0.8.7.json) |
| Reference coverage | 11 | [report](validation-coverage-v0.8.7.json) |
| Deterministic build and archive integrity | 11 | [report](validation-build-v0.8.7.json) |

Shortcut checks cover manual input/save, strict invalid-combination feedback, Shift+A defaults and migration, custom/disabled persistence, trusted keyboard events and input/editor exclusions. Esc, Tab, blur and cancel-button recording cancellation are covered. Color checks preserve API profiles, cache, active requests, document geometry and original/compare rendering. Figure selection includes pending and search-hidden items without downloading or calling AI.

The broader checks cover viewport scheduling, dynamic/target-language content, explicit error/cancel handling, upstream model discovery, documents, numbered captions and high-resolution originals, visual supplementation, native/AI-transcribed table export, reference coverage, Skills, optional memory and narrow layouts.

All browser suites use isolated Edge profiles, synthetic credentials, generated documents, saved public fixtures and localhost simulated APIs. No user API settings or live AI are accessed. Results verify behavior, not real-provider speed/accuracy or availability. Current Chrome integration is not verified. Desktop/narrow UI screenshots are saved alongside the reports. Build regression verifies deterministic runtime/source ZIPs, staged dependencies, exact entry bytes, rejection of damaged/private packages and matching hosted/installed privacy policies. Final runtime validation and exact ZIP byte audits are also required before upload.

Keep the same unpacked installation directory, reload in `edge://extensions`, confirm 0.8.7, then refresh source pages. Existing research windows keep earlier captured material. See [release notes](RELEASE_NOTES_0.8.7.md) and [actual publication record](STORE_SUBMISSION_0.8.7.md).

## Previous: QudadFlow Translator 0.8.6 trial verification

Date: October 22, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **245 checks passed, zero failures.** This is a local trial; no 0.8.6 GitHub, Edge or Chrome update has been submitted.

| Suite | Passed | Report |
| --- | ---: | --- |
| Webpage/providers, immersive colors and shortcut | 120 | [functional results](validation-v0.8.6.json) |
| Saved configurations and optional permissions | 14 | [configuration results](validation-configuration-v0.8.6.json) |
| Document layout and immersive colors | 20 | [layout results](validation-layout-v0.8.6.json) |
| Paper companion and select-all controls | 25 | [companion results](validation-companion-v0.8.6.json) |
| Research, Skills, memory and document selection | 19 | [research results](validation-research-v0.8.6.json) |
| PDF, DOCX, TXT and Markdown reader | 34 | [document results](validation-documents-v0.8.6.json) |
| Publisher captions, filtering and originals | 13 | [publisher results](validation-publisher-v0.8.6.json) |

All-selection includes search-hidden items and pending originals, works with no search matches, synchronizes detail cards and batch analysis, and clears globally without downloads or API calls. Batch loading and analysis retain their existing locks and request limits. Native text tables remain included in paper material without image selection; paper Q&A still accepts at most four selected originals.

Color checks cover picker/HEX/reset, invalid input, immediate updates in open shadow roots and same-origin frames, active-translation continuation and cache reuse. Document checks compare PDF canvas pixels/overlay geometry and preserve Word original/compare colors, TXT/Markdown layout and overflow fallbacks without additional API calls. Shortcut checks use real isolated-browser keyboard events for default/custom/disabled combinations and exclude inputs, contenteditable and ARIA/shadow editors. Tests also cover synthetic event rejection, configuration persistence, origin registration and permission refresh/revocation. Permission decisions are simulated inside isolated tests, not changed in the user's browser. Settings and figure-picker layouts were visually inspected at desktop and narrow widths.

All browser suites use isolated Edge profiles, synthetic credentials, generated documents, saved public fixtures and local simulated APIs. No user API settings or live AI are accessed. Results verify behavior, not real-model speed/accuracy or provider availability. Current Chrome integration is not verified. Model, visual supplementation, reference-coverage, table-export and earlier full-build suites remain historical baselines rather than newly run checks. Current packaging independently validates 253 runtime files/24 first-party scripts, staged dependencies, and exact ZIP entry names and bytes.

Reload the existing unpacked installation in `edge://extensions`, confirm **0.8.6**, refresh the source page and create a fresh research capture. Existing windows keep their earlier material. Copying installation files does not confirm browser activation. See [0.8.6 trial notes](RELEASE_NOTES_0.8.6.md).

## Previous: QudadFlow Translator 0.8.5 trial verification

Date: October 22, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **264 checks passed, zero failures.** This is a local trial; no 0.8.5 GitHub, Edge or Chrome update has been submitted.

| Suite | Passed | Report |
| --- | ---: | --- |
| Webpage/providers and immersive translation | 110 | [functional results](validation-v0.8.5.json) |
| Model discovery and draft connection tests | 23 | [model results](validation-models-v0.8.5.json) |
| Saved configuration and optional permissions | 14 | [configuration results](validation-configuration-v0.8.5.json) |
| Paper companion and batch original loading | 24 | [companion results](validation-companion-v0.8.5.json) |
| Publisher captions, filtering and originals | 15 | [publisher results](validation-publisher-v0.8.5.json) |
| Visual supplementation, rendering and storage | 25 | [vision results](validation-vision-v0.8.5.json) |
| Research, Skills, memory and document selection | 19 | [research results](validation-research-v0.8.5.json) |
| PDF, DOCX, TXT and Markdown reader | 34 | [document results](validation-documents-v0.8.5.json) |

The actual isolated Edge worker completes a synthetic draft connection test after waiting 47 seconds for response headers, beyond the former 45-second default. Model listing waits beyond the former 15-second deadline. Simulated header/body/SSE stalls remain pending until completion or cancellation; HTTP 400/401/429/504 stop before an unfinished error body. Temperature rejection reports HTTP 400 without retry. Draft cancellation is isolated by settings-tab/request ownership; closing the owner aborts its HTTP call. Saved configurations omit legacy timeout values.

Viewport tests hold running API calls while scrolling and verify the next work comes from the new viewport. Long paragraphs yield between chunks, and an idle worker handles newly expanded visible content while another request remains pending. Large-page, frame/shadow, language-skip, streaming, mutation, selection, cache and source-restoration regressions pass.

Publisher checks exclude ordinary article photos and unlabeled canvases while retaining numbered/captioned figures and image tables. The saved Dovepress paper retains two figures, three image tables, zero false native layout tables and its 2,029 × 712 original. Companion checks load all pending originals without selection, combine source permissions, preserve selection and retry failed items. The optional saved Ovid scenario was not rerun in this suite; its earlier result remains a baseline. Overview/table layouts were visually inspected at desktop and narrow widths.

Configuration checks exercise the explicit all-website grant, browser denial, retained local settings and revocation of both broad and earlier individual origins. These permission decisions are mocked inside the isolated test UI; they do not grant access in the user's browser. Model/test ownership and tab-close cancellation run against the real isolated extension worker.

All browser suites use isolated Edge profiles, synthetic credentials, generated documents, saved public fixtures and local simulated APIs. No user API settings or live AI are accessed. Results verify behavior, not real-model speed/accuracy or provider availability. Current Chrome integration is not verified. The 0.8.4 reference-coverage/table-export and earlier full-build suites remain historical baselines. Current packaging independently validates 252 runtime files/23 first-party scripts, staged dependencies, and exact ZIP entry names and bytes; source-only reports/screenshots and saved publisher fixtures are excluded from the runtime.

Reload the existing unpacked installation in `edge://extensions`, confirm **0.8.5**, refresh the source page and create a fresh research capture. Existing windows keep their earlier material. Copying installation files does not confirm browser activation. See [0.8.5 trial notes](RELEASE_NOTES_0.8.5.md).

## Previous: QudadFlow Translator 0.8.4 trial verification

Date: October 22, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **218 focused checks passed, zero failures.** This is a local trial; no 0.8.4 GitHub, Edge or Chrome update has been submitted.

| Suite | Passed | Report |
| --- | ---: | --- |
| Webpage/providers and immersive translation | 101 | [functional results](validation-v0.8.4.json) |
| Numbered publisher captions and original images | 14 | [publisher results](validation-publisher-v0.8.4.json) |
| Paper companion and shared figure selection | 26 | [companion results](validation-companion-v0.8.4.json) |
| Visual supplementation, rendering and storage | 25 | [vision results](validation-vision-v0.8.4.json) |
| Research, Skills, memory and document selection | 19 | [research results](validation-research-v0.8.4.json) |
| Conservative reference coverage | 11 | [coverage results](validation-coverage-v0.8.4.json) |
| Copyable tables across web and documents | 22 | [table export results](validation-table-export-v0.8.4.json) |

Immersive checks cover more than 80 paragraphs/12,000 nodes, short and nested text, open shadow roots, same-origin frames, body content outside article containers, local target-language skipping, mixed CJK, streaming, dynamic insertion/editing/expansion/lazy visibility, scroll supplementation, stale results, opt-outs and cleanup. Direct flex/grid text preserves its neighboring flow item, and restoration retains original Text nodes and links. Existing provider, selection, queue, cache, cancellation and configuration checks pass.

Publisher checks use generic fixtures for numbered English/Chinese/supplementary captions, exact references and anchors, multipanel images, small icons and layout-table exclusion. Linked originals retain high-resolution pixels in the actual simulated AI payload. Signature/decoding tests cover missing/generic MIME, HTML, corrupt images, excessive size, permission denial and stored-source restrictions. The saved public Dovepress fixture yields two figures, three image tables and no native layout tables; its 2,029 × 712 original loads without a Content-Type header. The saved Ovid paper still yields four unique figures and four native table cards. Publisher HTML/JPEG fixtures stay outside repository and packages.

Table checks exercise immediate local Markdown/TSV copy, captions/notes, repeated merged headers, rowSpan=0, 350 data rows, leading-zero and signed/scientific numeric strings, escaped pipes/backslashes, literal Markdown/HTML-like source text, multiline cells, formula literalization, padded TSV and UTF-8 BOM downloads. They check clipboard-denial manual copying, explicit batch/single-image requests and prompt/image payloads, unverified notices, no-table responses, retries and aborts. Word native tables, whole-document TXT/Markdown indexing and replacement, PDF page transcription and inert fenced code are tested. Table cards and controls were visually inspected at 390, 620 and 1440 pixels without page overflow.

All browser tests use isolated Edge profiles, generated documents, synthetic credentials and local simulated APIs. They do not read real user settings or call live AI. These results establish behavior, not real-provider availability, speed or vision/transcription quality. Chrome integration was not newly verified. Earlier wider build tests remain prior baselines and were not all rerun. Each current package independently validates 252 runtime files/23 first-party scripts, staged dependencies and exact ZIP entries/bytes.

After updating local installation files, reload the same unpacked extension in `edge://extensions`, confirm **0.8.4**, refresh the source page and create a new research capture. Existing windows keep their earlier material. File copying does not establish activation in the user's browser. See [0.8.4 trial notes](RELEASE_NOTES_0.8.4.md).

## Previous: QudadFlow Translator 0.8.3 trial verification

Date: October 21, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **70 focused checks passed, zero failures.** This is a local Edge trial. No 0.8.3 GitHub, Edge or Chrome store update has been submitted. Earlier suites below remain prior baselines and were not all rerun for this change.

| Suite | Passed | Report |
| --- | ---: | --- |
| Paper companion and figure selection | 26 | [companion results](validation-companion-v0.8.3.json) |
| Visual supplementation, rendering and storage | 25 | [vision results](validation-vision-v0.8.3.json) |
| Research, Skills, memory and document selection | 19 | [research results](validation-research-v0.8.3.json) |

Selection checks cover metadata-only pending tiles, search and hidden selections, gallery/detail synchronization, grouped Q&A, permission denial, a single batch permission request in the click chain, partial download failure and retry, source/configuration invalidation, and removal/reloading. Selections of more than four images are allowed for sequential batch analysis; pending or oversized Q&A selections are rejected before sending while retaining existing answers and history. Tests verify that only selected images are analyzed, one image per request, and stopping prevents subsequent requests. Selection and question staging do not call AI.

Native text tables automatically remain in paper material and support expanding/collapsing all previews. PDF selections survive page navigation and retain the extraction-page source. Replacing an imported document clears its selection and search. Existing long-text, generic capture, supplementary-image, rendering, Skill and memory checks pass. The saved public Ovid fixture still yields four unique figures, four independent table cards and 42,432 extracted characters; its HTML stays outside the repository and packages.

The figure overview was visually inspected at 390, 620 and 1440 pixels, with no horizontal overflow in the tested layouts. Screenshots use generated figures and simulated answers. All browser checks use isolated Edge profiles, synthetic credentials and local simulated APIs. No real user settings, private provider keys or live AI were used. These checks establish workflow behavior, not real-provider speed or vision accuracy. Chrome integration was not newly verified.

Packaging validates 251 runtime files and 22 first-party scripts, checks staged dependencies and audits runtime/source ZIP contents byte-for-byte. Keep the existing unpacked installation directory, reload in `edge://extensions`, confirm **0.8.3**, refresh the paper and open a new research window. Copying files does not establish activation in the user's browser. See [0.8.3 trial notes](RELEASE_NOTES_0.8.3.md).

## Previous: QudadFlow Translator 0.8.2 trial verification

Date: October 21, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **74 focused checks passed, zero failures.** This is a local Edge trial; no 0.8.2 GitHub or store update has been submitted. The wider 0.8.1 results below remain the prior baseline and were not all rerun for this change.

| Suite | Passed | Report |
| --- | ---: | --- |
| Conservative reference coverage | 11 | [coverage results](validation-coverage-v0.8.2.json) |
| Paper companion/generic capture | 20 | [companion results](validation-companion-v0.8.2.json) |
| Visual supplementation/rendering/storage | 25 | [vision results](validation-vision-v0.8.2.json) |
| Research/Skills/memory | 18 | [research results](validation-research-v0.8.2.json) |

Coverage checks distinguish numbered references from leading caption identities, fallback labels, image tables, partial captures and supplemental references. Zero tables does not imply failure or call AI. The companion tests retain long-paper material and later-paper extraction; the saved public Ovid fixture yields four unique figures and four independent table cards. The fixture HTML remains outside the repository and packages.

Visual tests exercise the single popup action, same-window supplementation, retained edits/questions/answers, local-only previews, image deduplication, restored previews, explicit AI reading with transcription instructions and image-assisted paper Q&A. Source checks reject another active tab, switching away and back during capture, scrolling, changed URLs/documents, closed tabs, lost access and expired captures. Webpages and other extension views cannot invoke source-focus or supplementary-capture messages. Raw URL parameters and the internal binding are absent from returned captures. Existing import, renderer and document-replacement checks pass.

The 620- and 1440-pixel research layouts were visually inspected without horizontal overflow. Screenshots show generated material and simulated responses. Browser checks use isolated Edge profiles, synthetic credentials and local simulated APIs. No real user settings, private provider keys or live AI were used. The tests establish workflow behavior, not real-provider speed or vision accuracy; Chrome integration is not newly verified.

The final packaging step validates 250 runtime files and 21 first-party scripts, checks staged resources and dependencies, and audits runtime/source ZIP contents byte-for-byte. Keep the existing unpacked installation directory, reload in `edge://extensions`, confirm **0.8.2**, refresh the paper and open a new research window. Automated checks do not establish activation in the user's browser. See [0.8.2 trial notes](RELEASE_NOTES_0.8.2.md).

## Previous: QudadFlow Translator 0.8.1 trial verification

Date: October 21, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **240 checks passed, zero failures:** 229 across eight Edge suites and 11 local build checks. This is a local trial; 0.8.1 has not been published to GitHub or either store.

| Suite | Passed | Report |
| --- | ---: | --- |
| Webpage/providers | 87 | [functional results](validation-v0.8.1.json) |
| Documents | 34 | [document results](validation-documents-v0.8.1.json) |
| Saved configurations | 13 | [configuration results](validation-configuration-v0.8.1.json) |
| Models/settings | 22 | [model results](validation-models-v0.8.1.json) |
| Layout/figures | 17 | [layout results](validation-layout-v0.8.1.json) |
| Research/Skills/memory | 18 | [research results](validation-research-v0.8.1.json) |
| Paper companion/generic capture | 20 | [companion results](validation-companion-v0.8.1.json) |
| Visual fallback/rendering/storage | 18 | [vision results](validation-vision-v0.8.1.json) |
| Reproducible build and damaged packages | 11 | [build results](validation-build-v0.8.1.json) |

All browser suites use isolated Edge profiles, synthetic keys and localhost simulated APIs; no private user settings or live AI account was accessed. Tests cover the production document reader and permission behavior, translation, models, research memory, figure/code analysis, errors and cancellation. They establish neither real-provider latency/availability nor translation or vision accuracy. Chrome integration is not newly verified.

Generic capture checks include sibling HTML/ARIA tables, captions/notes, row/column spans, duplicate panels, one-column safe rendering, lazy/semantic sibling figures and navigation to later papers. A saved public Ovid article yields four unique figures, four independent table cards and 42,432 extracted characters, with its external supplement marked unread. The fixture remains outside the repository and packages; table bodies are represented only by character counts in the report. The long-paper check preserves the final marker beyond 200,000 characters, and the document suite preserves a 2.1-million-character text. No fixed body-text cutoff is reintroduced.

Visual checks cover explicit viewport capture, local image import/paste, deduplication, invalid files, source replacement, vision transcription instructions and PDF region selection. New checks verify that 200 rapid updates are combined into two actual DOM renders, stopped streams flush, cancelled updates cannot repopulate cleared output, figure/code streams combine fragments, and one viewport screenshot retains all 100 ordinary candidates. Loading remote-image metadata does not decode stored image Blobs. Table cards at 620/1440 pixels and image-import controls at 620 pixels were visually inspected; displayed responses are simulated.

Build checks execute the real PowerShell packaging script on disposable source snapshots. They verify identical runtime/source ZIPs after only file modification times change, automatic audit/SHA256 output, inclusion of new modules, and rejection of missing transitive imports, syntax errors, remote executable imports, missing PDF codecs, private paths, omitted/altered/extra archive files and divergent privacy copies. An initial Windows ZIP timestamp ordering issue was fixed and the complete build suite rerun successfully. The final packaging command checks 249 runtime files and syntax for 20 first-party scripts, validates staging, and audits exact ZIP contents. Reproducibility was checked on this environment; it is not a cross-version compression guarantee.

Activation of the user's existing browser installation remains separate: preserve its unpacked directory and local data, reload the extension in `edge://extensions`, confirm 0.8.1, refresh the webpage and capture the paper again. Automated tests did not control or reload that installation. Existing capture windows keep their original material.

Known limits: heuristic extraction, protected/embedded content, bounded figure resources and table dimensions, manual supplement retrieval, no built-in scan-body OCR, no layout-preserving translated PDF/DOCX export, and no execution of generated Python/R. Full body material has no fixed character cutoff; upstream context/request limits and browser resources still apply. See [0.8.1 trial notes](RELEASE_NOTES_0.8.1.md).

## Previous: QudadFlow Translator 0.8.0 trial verification

Date: October 21, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. This is a local trial candidate; no 0.8.0 store or GitHub release was submitted.

After the independent table panel and visual-fallback update, **67 checks passed, zero failures**: companion 20 ([report](validation-companion-v0.8.0-table-fix.json)), vision 12 ([report](validation-vision-v0.8.0.json)), research 18 ([report](validation-research-v0.8.0-table-fix.json)), layout/figures 17 ([report](validation-layout-v0.8.0-table-fix.json)). Tests cover sibling HTML/ARIA tables, rowspan/colspan, captions/notes, one-column safe rendering, separate table cards at 620/1440 pixels, semantic sibling figures, CSS-only tables through explicit viewport capture, stale-page rejection, PNG/JPEG/WebP import, clipboard images versus ordinary text paste, deduplication, invalid/oversized files, replacement during import, vision transcription instructions, cancellation and PDF vector-region cropping. Screenshots of narrow import controls and wide table cards were visually checked. Live vision accuracy was not tested. The public Ovid fixture yields four independent table cards; the report retains table metadata and character counts, without reproducing its table body.

The following **210 checks** describe the initial 0.8.0 baseline, before this patch; unchanged suites were not rerun for the patch.

| Suite | Passed | Report |
| --- | ---: | --- |
| Paper companion/generic capture | 19 | [companion results](validation-companion-v0.8.0.json) |
| Models/settings | 22 | [model results](validation-models-v0.8.0.json) |
| Webpage/providers | 87 | [functional results](validation-v0.8.0.json) |
| Documents | 34 | [document results](validation-documents-v0.8.0.json) |
| Saved configurations | 13 | [configuration results](validation-configuration-v0.8.0.json) |
| Layout/figures | 17 | [layout results](validation-layout-v0.8.0.json) |
| Research/Skills/memory | 18 | [research results](validation-research-v0.8.0.json) |

All suites use isolated Edge profiles, synthetic keys and local simulated APIs. They do not access private user settings or live AI credentials. Provider quality, latency, cost, model context capacity and vision accuracy are not established by these checks.

New companion checks verify independent popup/maximize behavior, safe Markdown tables/code, narrow and wide layouts, two original images in both Chat Completions and Responses, selected-image limits, follow-ups/reset/export, partial-answer handling, actual SSE/HTTP/EOF failures and cancellation. A response-header delay of 36 seconds succeeds despite a saved 10-second basic translation timeout. Settings fold/persist/navigation behavior is covered. Screenshots at 620 and 1440 pixels and the folded settings screenshot were visually inspected; displayed answers are simulated.

Generic capture fixtures cover article/main/itemprop/plain-body structures, substantive material versus a teaser, inline citations, lazy images, and distinct panels with a shared caption. A same-tab navigation test verifies a later paper gets fresh text and figures while the earlier companion retains its source. A paper over 200,000 characters keeps its final marker both after capture and in the analysis HTTP payload. The document suite also checks a 2.1-million-character text beyond 300 reading sections without losing the ending.

The optional real-paper test reads a saved public Ovid article, DOI `10.1097/MD.0000000000044376`. It identifies four unique high-resolution figure sources, four HTML tables and the paper's full sections, with its external supplement explicitly unread. It makes no AI call. The copyrighted HTML fixture is outside the repository and is not distributed. Reproduce generic companion checks with `node tools/research-companion-check.cjs results.json`; pass a saved copy of that public HTML as the second argument for the Ovid assertion.

The model harness originally hardcoded 0.7.1 in its output names and report metadata while testing the 0.8.0 manifest. The harness now derives the version from the manifest. The report metadata and newly generated screenshot names have been corrected, with provenance noted in the report; historical tracked reports were not changed.

Actual user-profile update was not completed: the Windows computer-control tool stopped because it could not reliably determine the browser URL. No user API configuration was changed. An isolated Edge installation and all automated checks succeeded; this does not mean the user's existing browser installation was reloaded. Chrome integration is not newly verified.

Known limits remain: heuristic extraction, protected frames/images, bounded figure resources and table dimensions, no automatic supplement reading or scan-body OCR, no layout-preserving translated PDF/DOCX export, and no execution of generated Python/R. Full body material has no fixed character cutoff, but upstream context/request limits and browser resources still apply.

## Previous: QudadFlow Translator 0.7.1 verification

Date: October 21, 2026 (Asia/Shanghai). Microsoft Edge 155.0.4283.62. **191 checks passed, zero failures.**

| Suite | Passed | Report |
| --- | ---: | --- |
| Models/settings | 22 | [model results](validation-models-v0.7.1.json) |
| Webpage/providers | 87 | [functional results](validation-v0.7.1.json) |
| Documents | 34 | [document results](validation-documents-v0.7.1.json) |
| Saved configurations | 13 | [configuration results](validation-configuration-v0.7.1.json) |
| Layout/figures | 17 | [layout results](validation-layout-v0.7.1.json) |
| Research/Skills/memory | 18 | [research results](validation-research-v0.7.1.json) |

All suites use generated documents, synthetic keys, local simulated APIs and isolated Edge profiles. They do not read a real user's API settings. No live-provider request was made for this release; latency, quality, billing, service availability and vision accuracy are not measured.

New checks cover root/base/full endpoint routes; model list response variants, duplicates and caps; explicit selection without replacing existing models; reported versus unknown capabilities; safe metadata rendering; draft tests without applying/saving; cancellation, stale requests and tab isolation; errors, redirects, response-size limits and 15-second deadlines; options-page authorization and secret redaction. Responsive settings were checked at 1440, 900, 600 and 390 pixels with no horizontal overflow. Desktop and mobile screenshots were visually inspected.

A separate installed-Google-Chrome attempt passed two pure logic checks, then timed out waiting for the extension service worker after 30 seconds. Report: [Chrome attempt](validation-chrome-attempt-v0.7.1.json). No Chrome UI/integration checks ran. The cause is not established; this is an incomplete Chrome validation, not a Chrome pass. The shared Manifest V3 package has no Edge-only update URL. Actual Chrome installation and store review remain separate pending steps.

Run the six corresponding tools/*-check.cjs scripts to reproduce the Edge checks. Runtime packaging validates the explicit resource allowlist and matching English privacy copies. Known limits from 0.7.0 remain: heuristic extraction, no scan-body OCR, no layout-preserving PDF/DOCX export, and no execution of generated Python/R.

## Previous: QudadFlow Translator 0.7.0 verification

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
