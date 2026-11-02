# Document ingestion

Local implementation on `codex/coding-alias-context`, November 1, 2026. Release evidence is recorded in `docs/implementation/evidence/remaining-work/2026-11-01/`.

## PDF and OCR

Run `npm run setup:dabook -- --ocr` to install the optional CPU OCR engine. The setup script also detects a virtual environment whose interpreter disappeared after an account migration and repairs its interpreter while preserving existing files.

With `DABOOK_ENABLED=true`, `PDF_OCR_ENABLED=true` enables scanned-page OCR in structured ingestion. DABOOK rasterizes pages with PDFium and runs RapidOCR; native text pages retain their original extraction. For standalone ingestion, use `python -m dabook ingest --ocr --json -w <workspace> -- <book.pdf>` or configure:

```toml
[extract.routing]
scanned = "ocr"
```

The flat PDF fallback also tries managed RapidOCR before legacy rasterizers when PDF OCR is enabled. It reports missing engines and per-page limits. Empty recognition results cannot become completed text simply because a page label exists. A scanned book with no usable output ends in `needs_input`; extraction failures and quality deductions remain visible. Rasterization is limited to 40 megapixels per page, and the flat helper has a two-minute timeout.

## Structure, tables, and equations

When an outline is absent, `toc_mode = "auto"` uses character-weighted body font size and larger heading-size clusters. `structure.toc_mode = "typography"` explicitly selects this behavior. Outlined documents preserve their outline matching.

`npm run setup:dabook -- --docling` installs the optional Docling backend (Docling 2.145 or later within major 2). Set `extract.backend = "docling"` in the workspace configuration, or pass `--backend docling` to standalone ingest. Detected tables retain Markdown grids. Native PDF glyph geometry can promote conservative formula candidates before formula enrichment and tighten formula image crops to the actual ink, including Docling formula regions whose text is initially empty. Detection and crop provenance remain in block metadata. CPU formula inference uses float32; other accelerators retain the engine's automatic precision. Its initial use can download model artifacts. See [Docling enrichments](https://docling-project.github.io/docling/usage/enrichments/).

The original calibration PDF now yields the correct `E = mc²` formula and its complete table. A separate two-page fixture passes all three equations (power, fraction, and quadratic formula), preserves its table, and produces no equation false positives from prose/code controls. These generated fixtures establish regression coverage, not accuracy across arbitrary books; the backend stays opt-in. See the [follow-up quality evidence](implementation/evidence/remaining-work/2026-11-01/follow-up/README.md). Docling runs once per complete PDF because its converter processes the whole book; the PDFium route retains page sharding. Rendering remains enabled for table/formula enrichment.

Published-book validation now covers seven selected pages from *Calculus Made Easy* and *OpenIntro Statistics*: all eight target equations, four headings, and two upright table checks pass. Two sideways tables lose their row/column relationships. A native-glyph angle guard marks those regions for review, preserves their output and source coordinates, and lowers confidence below the default review/export thresholds. Unreviewed training export is blocked by the existing policy. Explicitly rotating the affected page upright recovers both checked tables in a separate diagnostic; automatic rotation with source-coordinate mapping remains future work. See the [published-book evidence](implementation/evidence/dabook-validation/2026-11-01/README.md). These are selected-page results, not full-book accuracy estimates.

The review warning works through configured quality thresholds. The defaults block unreviewed export; an operator who lowers those thresholds can override that score gate. The reported `review_required` field is not an unconditional export prohibition.

EPUBs use the same headless contract and Book Graph as PDFs. Package metadata, spine order, heading hierarchy, tables, MathML metadata, and code blocks survive extraction. Archive entries are read in memory with size limits; external references and unsafe paths are refused. EPUB page indices identify logical spine items, not physical page numbers.

## Training handoff

The governed export lane still enforces licenses, review, assisted generation, and held-out evaluation separation. New exports include SHA-256 hashes for bundle files. Prepare a local Axolotl configuration with:

```powershell
npx tsx scripts/dabook/prepare-training.ts <governed-bundle-directory> <base-model>
```

The helper validates export governance and file hashes, normalizes assisted SFT conversations, and writes `training-plan/axolotl.json` plus split files. Validation data is used for trainer evaluation; the test split remains held out. The format follows [Axolotl dataset loading](https://docs.axolotl.ai/docs/dataset_loading.html).

Plan preparation does not start training or activate a model. A separate, bounded CPU lifecycle runner can now exercise real optimization, held-out loss evaluation, integrity checks, and inactive registration. From a source checkout, with an existing PyTorch environment:

```powershell
node --import tsx scripts/dabook/create-training-smoke-fixture.ts temp/training-demo/bundle
node --import tsx scripts/dabook/run-cpu-training.ts temp/training-demo/bundle C:/path/to/python.exe temp/training-demo/run
```

The fixture command explicitly labels assistant-authored test data and opts into fixture mode. Ordinary preparation continues to require exporter-origin governance. Launch and result import recheck licensing, source hashes, prepared split bytes, config wiring, and held-out separation; the Python runner also verifies its launch attestation. Overlong conversations are refused rather than silently truncating assistant responses. Output includes a checkpoint, model configuration, hash-bound result manifest, and inactive-candidate registration evidence. Held-out loss/perplexity are language-model metrics, not accuracy scores.

This is a trusted local operator workflow. Manifest governance/license fields and external trainer metrics are declarations; hashes verify consistency and detect changes, but are not signatures authenticating exporter authorship, source rights, or external optimizer execution. Imported evidence requires operator review. A CPU random-init plan cannot be relabeled as a pretrained Axolotl result.

This CPU runner uses a tiny randomly initialized byte Transformer and proves the lifecycle only. It does not fine-tune the configured base model or produce a useful domain model. Registration uses a process-local `ModelUpdater` plus a durable JSON evidence file; it does not add a persistent serving registry or activate the candidate. External Axolotl execution, useful-model evaluation, persistent model registration, and an explicit promotion workflow remain future integration work. Prepared configs currently contain local absolute paths and must be regenerated/reviewed when moving the bundle to another location.
