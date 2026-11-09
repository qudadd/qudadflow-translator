# QudadFlow Translator 0.9.8

Release prepared 2026-11-10. GitHub publication and Chrome/Edge review outcomes are recorded separately in the [three-platform submission record](STORE_SUBMISSION_0.9.8.md).

## One website authorization

- The popup, API configuration, remote document reader and original-figure loader request all HTTP/HTTPS origins in one browser confirmation. Existing optional manifest scopes are reused; no new permission or dependency is added.
- An individually granted website no longer hides the prompt for full website access. Denial, cancellation, failed checks and later revocation keep a visible retry. A grant immediately hides the prompt and applies to other websites.
- Browser commands/context menus without host access open the popup, with Settings as a fallback. Translation failures caused by missing API permission also open authorization.
- Granting access alone sends no content and does not enable selection buttons on every website. Browser-protected pages and the separate local-file switch keep their browser restrictions. Settings offers **撤销网站授权**.

## Continue webpage translation

- Immersive translation retains completed paragraph records and successful chunks within a long paragraph after an API error, rate limit, interrupted stream or explicit stop. The visible **继续翻译** button and the original translation action both resume missing work.
- In-flight and cancelled batches are recovered, including records already removed from the pending queue. Complete translations retain their DOM nodes and are not sent again. Partial stream output is never counted as complete.
- The separate webpage-text panel also keeps completed chunks, retries remaining chunks and assembles them in original order. It retains received partial text for viewing, while retrying that incomplete chunk.
- Fixing credentials or selecting another provider/model can continue unfinished content. Changing source/target language, restoring immersive originals or changing the paper resets the relevant checkpoint. Changes to immersive paragraph content invalidate only those records; changing panel source text rebuilds the panel checkpoint.
- Checkpoints stay in the current webpage's memory. Refreshing or closing the webpage loses progress. No translation history is written to disk; this is separate from saved paper Q&A workspaces. Failures do not trigger automatic retry loops.
- **恢复原文** removes translations and closes the webpage translation panel directly, without opening a result dialog. The popup's restore action uses the same cleanup.

See [verification](VERIFICATION_0.9.8.md). Earlier 0.9.7 submission records and frozen release assets are preserved.
