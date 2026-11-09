# Verification: website access and translation recovery (0.9.8)

Behavioral checks: 2026-11-09. Publication recheck: 2026-11-10. Actual GitHub/store outcomes are recorded separately in [the submission record](STORE_SUBMISSION_0.9.8.md).

| Check group | Passed | Failed |
| --- | ---: | ---: |
| Translation recovery and missing-access UI | 14 | 0 |
| Settings, permission prompts and configurations | 23 | 0 |
| Existing translation/provider/shortcut integration | 126 | 0 |
| Immersive webpage, authors and responsive layout | 183 | 0 |
| PDF, Word, text and remote-document workflows | 34 | 0 |
| Saved paper workspace and PMC recovery | 20 | 0 |
| Worker/cache/translation performance behavior | 11 | 0 |
| Quick checks: PDF planning, coverage, local translation, language handling and figure specification | 56 | 0 |
| Build reproduction and intentionally damaged package rejection | 12 | 0 |

Groups cover related behavior; counts describe this run and are not an estimate of independent product features or model accuracy.

## Evidence and limits

- Recovery checks drive the actual MV3 content script in an isolated Edge profile, with generated webpages and a local simulated HTTP API. Injected HTTP 429 errors, cancelled sibling batches and interrupted streams retain complete paragraphs/chunks, expose explicit resume and make no automatic failure retry. Clearing the worker cache before resuming verifies that completed work is not merely being resent and served from cache. Completed paragraph DOM nodes also retain their identity.
- Long-paragraph checks verify that the successful first chunk is not requested again, including after changing model configuration. Changing the saved target language then clicking Resume requests a new-language translation from the beginning. Page-panel checks compare client-accepted completed chunks, since a server can finish a response concurrently with client cancellation.
- Permission checks simulate native browser consent and assert both HTTP/HTTPS wildcard scopes, active click gestures, denial, delayed checks, immediate hiding, persistence across a different website, revocation and individually granted sites. Browser commands and missing API access open authorization; unsupported popup APIs fall back to Settings. Native consent clicks and a real personal browser's installation/update state were not automated.
- The unchanged production permission manifest is exercised separately for document rendering. Headless functional/document suites simulate only the native all-websites confirmation; generated documents and network requests remain local. The production runtime still pregrants only MyMemory, with the existing HTTP/HTTPS scopes optional.
- Webpage tests include 390/768/1440-pixel views, author lists, tables, links, formulas, editors, clipping, RTL text, dynamic content and large documents. Actual permission/recovery screenshots were inspected. The new authorization prompt uses larger type and visible keyboard focus. The mechanical design scan also reports pre-existing small-text/contrast findings elsewhere in the popup/settings; a general interface redesign is outside this change.
- Package checks pass for 278 runtime files, 45 first-party script syntax checks and bundled local dependencies. Installed/hosted English privacy files are byte-identical. No new runtime dependency or manifest permission is introduced.
- These checks test behavior, not real-provider translation quality, latency, availability or billing. This run does not establish Chrome browser integration; Chromium-compatible code remains shared.
- Continuation checkpoints remain in the current webpage memory. Refresh/close loses them; they are independent of persistent paper Q&A workspaces and contain no new disk-backed translation history.

The final silent-restore change passed the 14 recovery checks again, including a real restore-button click that removes the translation panel and does not reopen it after later DOM changes. On 2026-11-10, the 14 recovery checks and 56 quick checks passed again with zero failures. These repeat checks are not added to the counts above.

Private reports and screenshots remain outside the public repository under the portable workspace's `outputs/dev-runs/translation-recovery-0.9.8-20261109/`. Quick-check reports are in `outputs/dev-runs/20261109-234625-32f3b334/` and `outputs/dev-runs/20261110-001308-6ce84d24/`; publication evidence is in `outputs/dev-runs/store-submission-0.9.8-20261110/`. Earlier tagged archives and release records remain unchanged. The portable `development/Run-Checks.ps1` includes the recovery suite under `immersive` and `all`.
