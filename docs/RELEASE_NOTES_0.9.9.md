# QudadFlow Translator 0.9.9

2026-11-10. PDF.js code readability maintenance following Chrome review reference **Red Titanium**. Actual publication and store review states are recorded in the [submission record](STORE_SUBMISSION_0.9.9.md).

- Both bundled PDF.js modules now use an explicit `javascript:` literal and descriptive variable in the core-js legacy iframe fallback. The resulting value and fallback behavior are unchanged.
- The integrity-checked vendoring workflow reapplies the documented patch and stops on unexpected upstream changes. Package validation rejects regression in either module, including before producing a store-upload ZIP.
- Third-party notices identify the change and preserve original licenses. PDF.js remains pinned to 6.4.299; the reader's CSP and PDF scripting restrictions are retained.

The paper reading, corresponding PDF translation, figure learning, Python/R reproduction drafts, saved paper workspaces, one website authorization and resumable webpage translation from 0.9.8 continue in this release. The English/Chinese product descriptions are reused without changes; the optional Windows companion remains 0.9.2.

See the [readability correction](CHROME_READABILITY_0.9.9.md) and [verification](VERIFICATION_0.9.9.md). Earlier tagged release assets remain unchanged.
