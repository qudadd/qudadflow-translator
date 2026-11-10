# Verification: PDF.js readability correction (0.9.9)

2026-11-10. Focused checks for the correction documented in [CHROME_READABILITY_0.9.9.md](CHROME_READABILITY_0.9.9.md). **70 checks passed, zero failures**, plus package and module syntax validation.

| Check group | Passed | Failed |
| --- | ---: | ---: |
| PDF rendering, continuous/paged reading, extraction, independent cancellation and supplied PDF sample | 20 | 0 |
| PDF/Word/TXT/Markdown, production-manifest PDF rendering, local/remote document handling and simulated translation | 34 | 0 |
| Reproducible packages, staged validation and intentionally damaged build/archive rejection | 13 | 0 |
| Exact patch reproduction in both modules, idempotence, upstream drift rejection and protocol-value equivalence | 3 | 0 |

The package validator checks 278 runtime files, 45 first-party script syntaxes and local dependencies. Both edited PDF.js modules pass Node's module syntax check. The original assembled scheme is absent from vendored JavaScript; each edited module contains the explicit literal and matching assignment. Installed and hosted English privacy pages remain byte-identical.

The actual vendoring command was run against pinned npm archives. All four upstream SHA512 values matched. Its checked patch modified only the documented fallback declarations, assignments and explanatory comments in those two modules; the dependency metadata separately records the modification. Offline checks recreate the exact checked-in patched source from the upstream form, accept the already-patched source and reject upstream drift. Evaluating the two protocol expressions in isolated contexts returns the same `javascript:` string.

Build tests restore the original form separately in each module and verify that validation and packaging fail without replacing existing output packages. Normal runtime/source ZIPs reproduce byte-for-byte with changed source modification times. The remaining build tests cover missing codecs, mismatched display versions, imports, syntax, private files, archive inventory/bytes and privacy consistency.

PDF and document tests use disposable Edge profiles with real bundled parsers, generated fixtures and local simulated translation providers. One privately supplied ten-page paper was also opened: all four labelled figures and its six-column native table were extracted without an API call. The table has 24 rows. PDF canvases, text layers, rotations, navigation and page proportions passed; representative rendered views were visually inspected.

These results establish software behavior in the tested cases. They do not establish live-model translation/vision accuracy, external API availability, numerical chart recovery or Chrome store approval. The production-manifest PDF smoke check runs with only the existing pregranted MyMemory origin; test APIs are confined to isolated localhost fixtures. No personal browser profile or live credential is used by the regression scripts. No new permission, dependency version or optional companion build is introduced.

Reports and screenshots are private, outside the source repository in `outputs/dev-runs/pdfjs-readability-0.9.9-20261110/`. New final release assets are built separately under `outputs/dev-builds/release-0.9.9-20261110-final/`. Historical tagged packages remain unchanged. Actual publication and review states are tracked separately in [STORE_SUBMISSION_0.9.9.md](STORE_SUBMISSION_0.9.9.md).
