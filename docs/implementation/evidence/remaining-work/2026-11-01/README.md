# Remaining-work verification — November 1, 2026

Local changes on `codex/coding-alias-context`. The [machine-readable verification record](verification.json) binds the checked source and lockfiles to log hashes, commands, results, and coverage. [Check summaries](check-summaries.txt) preserve concise output; full diagnostic logs remain in the ignored workspace `temp/` directory.

Implemented:

- Compatible dependency repairs across server, client, desktop, coding tools, REA, and the optional DABOOK Python environment. See the [affected-path analysis](../../dependency-security/2026-11-01.md).
- Transactional versioned SQLite knowledge installation/update, recorded runtime-shadow reports, and owner-scoped coding-job retention, history, and downloads.
- Scanned-PDF OCR through PDFium/RapidOCR, typography headings, structured EPUB ingestion, optional Docling tables/formulas, and a governed Axolotl configuration handoff.
- Test isolation from local credentials and databases, boundary coverage, a coding-history browser workflow, and consistent dotenv selection for settings inspection.

The aggregate `verify:release` command exposed failures during this work. Its component checks were completed separately; coverage used JSON/LCOV output and a single test worker to accommodate this Windows host. An in-band Jest process exited with native Windows status `0xc0000409` before completing; the final server command uses a recyclable worker with a 1 GiB idle memory bound. Coverage thresholds and request/readiness assertions were preserved. This record describes local checks and does not establish clean-machine lifecycle or hosted-production certification.

## Live extraction scope

The [image-only PDF](scanned-ocr.pdf) yielded “Aurora observatory opens Thursday.” through both Python and the TypeScript subprocess route.

The [table/equation fixture](tables-equations.pdf) and [live benchmark](docling-benchmark.json) show one recovered Markdown table with the correct headers and both rows. PDFium flattened that table. Docling retained the displayed equation as text but did **not** detect an equation block. Semantic formula preservation has fixture tests; broad equation-detection quality remains unaccepted. Docling stays opt-in.

## Remaining work

- Live Ollama evaluation is deferred at the user's request until they are at the other PC hosting Ollama.
- Improve and benchmark equation detection across representative documents before enabling Docling by default.
- Execute training, evaluate the trained artifact against held-out data, and integrate model registration. The prepared handoff never starts training or activates a model.
- Verify optional REA on its declared supported Node version; this host uses Node 24.15.0.
- Migrate the root development toolchain to resolve its remaining 27 moderate and four low audit findings. All five shipped Node runtime trees and the installed DABOOK environment audit clean.
