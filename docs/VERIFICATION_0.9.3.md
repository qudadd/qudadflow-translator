# QudadFlow Translator 0.9.3 verification

November 2, 2026 (Asia/Shanghai). The feature implementation passed **548 checks in 23 suites, zero failures**, before the release-only manifest bump from 0.9.2 to 0.9.3. The new version then passed the package validator, all 39 quick checks and all 17 figure-workflow checks again. These repeated checks are not added to the 548-check total.

| Suite | Passed |
| --- | ---: |
| Functional behavior | 126 |
| Immersive layout | 32 |
| Documents | 34 |
| Configuration | 23 |
| Document layouts | 20 |
| Research | 19 |
| Model discovery | 23 |
| Model switching | 27 |
| Research companion | 25 |
| Visual supplementation | 25 |
| Linked tables | 19 |
| Publisher figures | 13 |
| Table export | 22 |
| PDF reader | 17 |
| PDF AI workflow | 29 |
| Three local PDF samples | 19 |
| Expanded workbench | 8 |
| Figure inspector and code workspace | 17 |
| Figure specification validation | 13 |
| PDF figure planning | 7 |
| Research coverage | 11 |
| Offscreen translation | 8 |
| Build and archive negative cases | 11 |
| **Total** | **548** |

The inspector checks cover native modal focus, closing/reopening streamed results, retained language tabs, switching and removing figures, responsive layout, exact clipboard text and fallback selection, wrapping, code enlargement and Esc restoration. Shared-specification compilation, explicit two-image visual revisions and rejected malformed/semantic revisions also pass.

Six additional style examples run the actual Python and R interpreters: line, bar and two-panel plots in each language, without CSV input. They produce PNG/PDF/SVG, editable SVG text, legends and a visible synthetic-demo label. These are style and execution checks, with no numeric-recovery acceptance.

Browser checks use isolated Edge profiles, generated fixtures and local synthetic providers. PDF samples exercise actual local page pixels with annotated simulated AI responses. No live model recognition, Chrome integration or store approval is established by these results. Local PDFs, page crops, browser sessions, machine paths and raw local diagnostics are excluded from public verification artifacts.

The package inventory validates 276 runtime files and syntax for 43 first-party scripts. The release build checks staged files, transitive local resources and every runtime/source ZIP entry against source bytes. Runtime assets contain no development tools or private fixtures.

[Release notes](RELEASE_NOTES_0.9.3.md) · [Workflow](FIGURE_REPRODUCTION.md) · [Publication status](STORE_SUBMISSION_0.9.3.md).
