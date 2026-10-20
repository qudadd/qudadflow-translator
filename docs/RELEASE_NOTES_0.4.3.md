# QudadFlow Translator 0.4.3

Development update. The Edge Add-ons submission remains version 0.4.2.

- Add streamed text for OpenAI-compatible Chat Completions and explicit Responses endpoints. Responses requests disable provider-side storage with `store: false`.
- Display elapsed time and translation progress. Insert completed immersive batches immediately, with at most two concurrent requests per page.
- Cancel pending requests when closing the translation panel, restoring original text, or starting a different translation. Prevent duplicate in-flight commands and repeated connection-test clicks.
- Bound paragraph-marker fallback requests and retain completed translations when another batch fails.
- Allow a 10–180 second request timeout and an empty Temperature value. Retry once without Temperature only after an explicit unsupported-parameter response.
- Handle content arrays, endpoint trailing slashes, truncated streams, invalid JSON, authentication errors, and gateway errors with clearer messages.

Validation: 68 checks passed using synthetic API responses and an isolated Edge profile. A separate unmodified-manifest smoke check confirms permission rejection before granting API-domain access. Live provider connectivity and latency remain unverified.

For an existing unpacked installation, replace its runtime files, reload the extension at `edge://extensions`, and refresh the webpage. Keep the same unpacked directory to retain browser-local configuration. This version does not implement direct PDF translation.
