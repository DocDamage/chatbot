# DABOOK Integration Plan

**Status:** Approved, decisions resolved (see §8) · **Date:** 2026-10-05 · **Source under review:** `F:\book2ml\Dabook` (DABOOK v1.0.22)

## 1. Verdict

**Yes, integrate it, with conditions.** DABOOK fills the weakest link in the Chatbot's knowledge pipeline: turning a PDF into retrievable knowledge.

| Concern | Chatbot today | DABOOK |
| --- | --- | --- |
| PDF text extraction | `pdf-parse` produces one flat string (`src/core/rag/ingestion/PdfExtractor.ts`) | Per-page blocks with bbox, font size, bold/mono flags, and the PDF outline (pypdfium2) |
| Headers, footers, page numbers, watermarks | Kept in the text and indexed | Removed (stage S04) |
| Multi-column reading order | Lost | XY-cut column detection (stage S05) |
| Document structure | None. Chunks are 500-word windows (`DocumentIngester.chunkText`) | Chapter and section graph with breadcrumbs (stages S06, S09, S12) |
| Code blocks | Mixed into prose | Typed `code` nodes with language tags (stage S08) |
| Citations | Source file only | Page number and breadcrumb path on every chunk |
| Large or batch books | Synchronous, in-request | Sharded, resumable, crash-safe job queue on SQLite WAL, with leases, retries and a cache keyed by content |
| Training data | None. `TrainingSeparationCoordinator` exists but nothing feeds it | Pretrain, SFT (Alpaca and ChatML), code, RAG and raw JSONL corpora |

The conditions: DABOOK has real runtime bugs, unimplemented options that it advertises as working, and heuristics tuned to one reverse-engineering book. Phase 1 fixes these before the Chatbot depends on it. The Chatbot keeps `pdf-parse` as an automatic fallback.

## 2. Findings from the review

### 2.1 What was verified

- **Unit and chaos tests:** `pytest` passed 34 of 34 on Python 3.12 in a clean venv. Required dependencies: pydantic, typer, rich, fastapi, uvicorn, pypdfium2, ftfy, portalocker, psutil, tomli_w, python-multipart.
- **End-to-end run:** `dabook run testdisk.pdf --no-ui` on an 80-page technical manual. All 17 tasks completed and the book was marked `done`. Output: 949 graph nodes, 158 RAG chunks, 42 pretrain documents, 41 SFT pairs and consolidated `compiled/all_*.jsonl` files.
- **Chatbot baseline:** `npx tsc --noEmit` is clean on Node 24.14.1.

### 2.2 Defects (must fix: Phase 1)

| # | Defect | Location | Impact |
| --- | --- | --- | --- |
| D1 | The supervisor never exits after all work is done. It logs "All work done. Supervisor idle." every second forever. `--watch` is accepted but does nothing. | `core/runtime/supervisor.py` `_run_loop`; `cli.py` `watch` | `dabook run --no-ui` cannot be used as a batch job or a subprocess. **This blocks integration.** |
| D2 | The dashboard **Launch** button is broken. `_launch_run_job` calls `cli.run(start_ui=…, open_browser=…, modes=[list])`, but `run()` takes `no_ui`/`no_open` and string `modes`. The resulting `TypeError` is swallowed by `except Exception: pass`. | `server/app.py` `_launch_run_job` | Books launched from the UI silently never run. The child would also hit `LockError`, because the UI process holds the workspace lock. |
| D3 | `/api/launch` accepts profiles `quality` and `archive`, which don't exist. The real profiles are `fast`, `balanced`, `accurate` and `lowram`. | `server/app.py` `ALLOWED_PROFILES` | `accurate` and `lowram` silently fall back to `balanced`. |
| D4 | `_get_latest_stage_dir` picks the commit with the *highest hex key*, not the commit that matches the current plan. | `stages/runner.py` | After a parameter change, downstream stages can read stale upstream output. |
| D5 | S03 merges **every** committed S02 directory, regardless of stage key. | `stages/runner.py` `_stage_s03_merge` | Re-running with different extract parameters duplicates pages. |
| D6 | Uploaded PDFs land in `workspace/inbox/` and nothing ever processes them. | `server/app.py` `/api/upload` | Upload looks successful but does nothing. |
| D7 | Stage `impl_version` lives in the planner ("0.1.0") but the code changes in the runner ("0.2.0-real"). | `scheduler/planner.py` vs `stages/runner.py` | Changing a stage's code doesn't invalidate its cache. Stale artifacts are reused. |
| D8 | `books.title` and `books.quality_score` are never written. S11 computes a score and discards it. | `stages/runner.py` S11 | The dashboard and API show null quality, and the review gate cannot work. |
| D9 | No `pyproject.toml`, no `dabook` entry point, no `__main__.py`, no lockfile, and not under version control. | Repository root | It can't be installed or reproduced. The only way to run it is `PYTHONPATH=src python -c "from dabook.cli import app; app()"`. |
| D10 | When the PDF path is missing, the worker silently runs `_run_fake_stage` (sleep plus a fake artifact) and marks the task **done**. | `core/runtime/worker.py` | A moved or deleted source PDF produces fake "successful" output. It should fail with `corrupt_pdf` or `missing_source`. |
| D11 | CORS `allow_origins=["http://127.0.0.1:*", …]`. Starlette doesn't expand wildcard ports. | `server/app.py` | Cross-origin calls from the Chatbot UI (port 3000) are rejected. |
| D12 | The `pytest.mark.slow` marker is not registered. | `tests/chaos` | Warning now. It becomes an error under `--strict-markers`. |

### 2.3 Options that are advertised but not implemented

- `extract.backend = docling | marker | mineru | olmocr` and `routing = {scanned: ocr}`. The runner always uses `PdfiumExtractor`. **Scanned PDFs produce empty datasets, with no OCR and no warning.**
- `dataset.modes` and `dataset.formats` (`parquet`, `hf`). All five JSONL files are always written. Parquet and HF output don't exist.
- `dataset.tokenizer`, `chunk_target_tokens`, `chunk_max_tokens`. Chunking is hard-coded to more than 400 words, and `estimate_tokens` is words × 1.33.
- `split`, `dedup`, `license`, `assist`, `quality.review_gate`. These are parsed and never applied.

### 2.4 Quality issues seen in the smoke-run output

- **Table-of-contents pages leak.** Dot-leader TOC lines ("1.1 TestDisk – Partition recovery 4 . . . .") become RAG chunks *and* SFT answers.
- **Domain overfitting.** The SFT system prompt is hard-coded to "expert systems engineer and reverse engineering specialist". The boilerplate filter matches "practical reverse". Code detection only knows x86 registers and C keywords: the manual's shell commands produced **0 code blocks**.
- **SFT pairs are templates, not Q&A.** Every concept pair is "Explain the architecture and technical mechanics of {heading}". Exercise answers repeat the question. These are not safe to fine-tune on without review.
- **Heading detection depends on bold text or an outline.** Books without a PDF outline lose most of their structure.

## 3. Target architecture

```
Chatbot (Node/TS)                                   DABOOK (Python sidecar)
──────────────────                                  ───────────────────────
POST /api/knowledge-base/file ─┐
Knowledge UI upload ───────────┤
                               ▼
                  DocumentManager.addFile
                               │
                  DocumentIngester ── ext=.pdf && DABOOK_ENABLED ──► DabookBridge.ingest(pdf)
                               │                                        │ spawn (runNativeCommand)
                               │                                        ▼
                               │                         dabook ingest <pdf> -w <ws> --json
                               │                         (one-shot, exits on completion; D1 fixed)
                               │                                        │
                               │◄──── IngestResult JSON (contract v1) ──┘
                               │      + books/<sha12>/datasets/rag.jsonl
                               ▼
         pre-chunked path: DabookChunkMapper → DocumentChunk[]
         (page, breadcrumbs→section, node type, sha256, quality)
                               │
               RAGDocumentStore.saveChunks + embeddings (unchanged)

         sft/pretrain/code.jsonl ──► TrainingCorpusImporter ──► TrainingSeparationCoordinator
                                     (license gate + contamination audit; Phase 4, opt-in)

  Fallback: bridge unavailable, timeout, or non-zero exit ──► existing pdf-parse PdfExtractor (+ warning)
```

Design decisions:

1. **Subprocess, not HTTP, for ingestion.** The Chatbot already has `runNativeCommand` (`src/core/native-runtime/NativeCommandRunner.ts`), which provides a timeout, output capture and `shell: false`, and a `CHATBOT_NATIVE_PYTHON` convention. A one-shot CLI with a JSON contract has no port, no token and no lifecycle to manage. The DABOOK dashboard (FastAPI on port 8765) stays optional, for batch monitoring.
2. **Consume `rag.jsonl`, not flat text.** Extend the extractor contract so an extractor can return **pre-chunked sections**. DABOOK's structure-aware chunks then bypass the 500-word chunker.
3. **One workspace owned by the Chatbot:** `data/dabook_workspace/`. The content-addressed cache means re-ingesting the same PDF is near-instant.
4. **Vendor DABOOK into the repo under `services/dabook/`** (decided). The F: copy has no git history, so the Chatbot repo becomes its version-controlled home. Python CI runs alongside Jest.
5. **Off by default** (decided). `DABOOK_ENABLED=false` until the Phase 3 exit criteria pass.
6. **The training-data lane is in scope** (decided). Phase 4 is a committed deliverable, not optional.

## 4. Phased plan

### Phase 0: Baseline and housekeeping (½ day)

1. Fix the git ownership error. Every git command in this checkout fails with "dubious ownership" because the files are still owned by the old Windows account, mid-migration to the current one. Pick one:
   - **Permanent (preferred once the migration is done):** take ownership of the tree from an elevated prompt with `takeown /F G:\dev\Chatbot /R /D Y`, then `icacls G:\dev\Chatbot /setowner "%USERNAME%" /T`. Do the same for `F:\book2ml` if it has the same issue.
   - **Interim:** `git config --global --add safe.directory G:/dev/Chatbot`. This is safe for repos you own, and you can remove it after the ownership fix.
2. Copy `F:\book2ml\Dabook` to `services/dabook/` (`src/`, `tests/`) on a new branch, `feat/dabook-integration`.
3. Add `services/dabook/pyproject.toml`:
   - `requires-python = ">=3.11"` (uses `tomllib`; tested on 3.12).
   - Dependencies: `pydantic>=2`, `typer`, `rich`, `fastapi`, `uvicorn`, `python-multipart`, `pypdfium2`, `ftfy`, `portalocker`, `psutil`, `tomli_w`.
   - Optional extras: `[gpu] pynvml`, `[ocr] rapidocr-onnxruntime`, `[docling] docling`, `[dev] pytest ruff mypy`.
   - `[project.scripts] dabook = "dabook.cli:app"`. Register the `slow` pytest marker (D12).
4. Add `src/dabook/__main__.py` so `python -m dabook` works (D9).
5. Commit a lockfile (`uv lock`).
6. Add `npm run setup:dabook`, a script that creates `services/dabook/.venv` with `uv` (falling back to `python -m venv` and pip) and installs `-e .[dev]`.
7. Add `npm run test:dabook` (`pytest services/dabook/tests`) and a CI job that runs it.
8. Record the dependency licenses in `THIRD_PARTY_NOTICES.md` and `docs/implementation/DEPENDENCY_AND_ASSET_TERMS_REGISTER.md`. pypdfium2 is Apache-2.0/BSD and PDFium is BSD-3. Check each optional extra before enabling it.

**Exit criteria:** `npm run setup:dabook && npm run test:dabook` passes from a fresh clone. `python -m dabook doctor` reports green.

### Phase 1: Make DABOOK run the way it was intended (2–3 days)

Fix in this order. Each fix gets a regression test.

| Step | Fix | Test |
| --- | --- | --- |
| 1.1 | **D1.** Add `exit_when_idle` to `Supervisor` (default `True` unless `--watch` or the UI is running). Once no tasks are pending or running and no books are active, drain the workers, close the DB and return. Implement `--watch` as a poll of `inbox/` plus any watched directories every N seconds that registers and plans new PDFs. | Integration test: `dabook run sample.pdf --no-ui` exits 0 within the timeout, and no `python` children are left. A watch-mode test drops a PDF into `inbox/` and asserts it reaches `done`. |
| 1.2 | **D2, D3, D6.** Replace `_launch_run_job` with in-process enqueueing. Since the UI process already holds the lock and the supervisor, `/api/launch` calls `register_pdf` and `plan_book` directly against the open workspace, and the running supervisor picks the tasks up. `/api/upload` enqueues immediately (or relies on watch mode). Validate profiles against `PROFILES.keys()`. Log exceptions instead of swallowing them. | FastAPI `TestClient`: upload, then launch, then the book appears with `queued` and later `done`. An unknown profile returns 400. |
| 1.3 | **D4, D5.** Pass the *planned upstream stage keys* to each task (store them in `task_deps` → `tasks.stage_key`) and resolve inputs by exact key. Delete `_get_latest_stage_dir`. S03 merges only the S02 shard keys of the current plan. | Run twice with different `ocr_dpi`, then assert the S03 page count equals the PDF page count, with no duplicates. |
| 1.4 | **D7.** Move `IMPL_VERSION` constants next to each stage function and have the planner import them. Bump all to `0.2.0`. | Change a stage version, then assert that the stage and its downstream stages re-plan as `pending`. |
| 1.5 | **D8.** S01 writes the PDF metadata title to `books.title`. S11 writes `books.quality_score`. When `quality.review_gate` is set and the score is below `quality.review`, set `books.state='review'`. | Unit tests on the runner with a fixture PDF. |
| 1.6 | **D10.** A missing source PDF fails the task (`error_class='missing_source'`). Move `_run_fake_stage` behind `DABOOK_FAKE_STAGES=1`, which only the chaos tests use. | Delete the PDF mid-run, then assert the task becomes `failed`/`dead`, not `done`. |
| 1.7 | **D11.** Build an explicit CORS origin list from config, defaulting to `http://localhost:3000`, `http://127.0.0.1:3000` and the dashboard's own port. | Request from `localhost:3000` gets a valid preflight response. |
| 1.8 | **Honor or reject the config surface (§2.3).** Implement `dataset.modes` (write only the requested files) and `chunk_target_tokens`/`chunk_max_tokens` (via `tiktoken` when installed, otherwise the estimate). Make `formats` other than `jsonl` and `backend` other than `auto`/`pdfium_pdfminer` **fail validation** with a clear "not yet implemented" message until Phase 5. Never ignore them silently. | Config validation tests. |
| 1.9 | **Scanned-PDF honesty.** S01 already computes `is_born_digital`. If it's false, record `books.doc_type='scanned'` and an `ocr_required` event, and finish with a `needs_input` state rather than empty "done" datasets. Phase 5 adds the OCR route. | Fixture: an image-only PDF ends in `needs_input`. |
| 1.10 | **Generalize the domain heuristics.** Make the SFT system prompt configurable (`dataset.sft_system_prompt`, generic default). Remove "practical reverse" and other book-specific terms from the filters. Add shell, Python, JS and SQL patterns to code detection, plus a monospace-font signal. **Drop TOC pages:** a block where 50% or more of the lines match `\.{3,}\s*\d+$` (dot-leaders) becomes `block_type='toc'`, which is excluded from rag/sft/pretrain. | Golden-file tests on `testdisk.pdf`-style fixtures: zero dot-leader chunks, more than 0 shell code blocks. |

**Exit criteria:** the full `pytest` suite passes, including new integration tests and chaos tests. A clean `dabook run` on 3 fixture PDFs (born-digital technical, two-column academic, scanned) exits by itself with correct states. The dashboard Launch and Upload buttons work end to end.

### Phase 2: Headless integration contract (1 day)

1. Add the command **`dabook ingest <pdf…> -w <ws> --json [--profile] [--modes rag,raw] [--timeout-s N]`**:
   - Runs register, plan, supervise and exit (reusing Phase 1.1), with no UI and no browser.
   - Writes **only** a single JSON document to stdout. Logs go to stderr and `ws/logs/`.
   - Exit codes: `0` ok, `2` needs_input (scanned), `3` failed, `4` lock held, `5` bad args.
2. Output contract `dabook.ingest.v1`. Publish a JSON Schema in `services/dabook/schemas/` and mirror it as a TS type:

   ```json
   {
     "schema": "dabook.ingest.v1",
     "dabook_version": "1.1.0",
     "workspace": "…/data/dabook_workspace",
     "books": [{
       "book_id": 1, "sha256": "958fa657…", "source_path": "…/manual.pdf",
       "title": "TestDisk Documentation", "pages": 80, "doc_type": "native",
       "state": "done", "quality_score": 0.95, "warnings": [],
       "datasets": { "rag": "books/958fa65703e6/datasets/rag.jsonl", "raw": "…", "sft": "…", "pretrain": "…", "code": "…" },
       "counts": { "rag": 158, "raw": 949, "sft": 41, "pretrain": 42, "code": 0 }
     }]
   }
   ```

   Paths are relative to `workspace`.
3. **Enrich `rag.jsonl` records** with what the Chatbot needs for citations: `book_sha256`, `book_title`, `page_start`, `page_end`, `node_ids[]`, `node_types[]`, `has_code`, `token_count`, `quality`. Keep `chunk_id` stable (use `core/ids.chunk_id`, which is defined but currently unused) so re-ingests update chunks in place instead of duplicating them.
4. Add the workspace lock behavior: `ingest` waits up to `--lock-wait-s` for a held lock, then exits `4`. The Chatbot serializes calls (see 3.2).

**Exit criteria:** contract tests in Python validate the output against the JSON Schema. Running `ingest` twice on the same PDF is idempotent (the second run is a cache hit, under 2 s, with identical `chunk_id`s).

### Phase 3: Chatbot integration (2–3 days)

New and changed files:

| File | Change |
| --- | --- |
| `src/core/rag/ingestion/ExtractedDocument.ts` | Add `sections?: PreChunkedSection[]` to `ExtractedDocument`, where `PreChunkedSection = { id, content, metadata }`. Add `preferStructuredPdf?: boolean` to `FileExtractionOptions`. |
| `src/core/dabook/DabookBridge.ts` (new) | Resolve the interpreter (`DABOOK_PYTHON` → `CHATBOT_NATIVE_PYTHON` → `services/dabook/.venv`). `health()` runs `python -m dabook doctor --json`, with the result cached. `ingest(pdfPath)` runs `python -m dabook ingest … --json` via `runNativeCommand` with `DABOOK_TIMEOUT_MS` (default 15 min), parses and validates the contract with zod, and returns a typed result. A per-workspace promise queue serializes calls (DABOOK takes a single-writer workspace lock). |
| `src/core/dabook/DabookChunkMapper.ts` (new) | `rag.jsonl` record → `DocumentChunk`. `id = dabook:<sha12>:<chunk_id>`, `metadata.source = source_path`, `title`, `page = page_start`, `section = breadcrumbs.join(' › ')`, `breadcrumbs`, `nodeTypes`, `hasCode`, `bookSha256`, `extractor: 'dabook'`, `qualityScore`, `parentId = dabook:<sha12>`. |
| `src/core/rag/ingestion/DabookPdfExtractor.ts` (new) | Implements `FileExtractor` for `.pdf`. Calls the bridge and returns `{ text, sections, metadata, warnings }`. On a bridge failure, timeout, exit code 2 or 3, or a disabled bridge, it **delegates to the existing `PdfExtractor`** and adds a warning such as `dabook-fallback: <reason>`. Exit code 2 also sets `metadata.needsOcr = true`, so the source shows up in the existing `/api/knowledge-base/ocr-queue`. |
| `src/core/rag/ingestion/FileTypeRouter.ts` | Register `DabookPdfExtractor` ahead of `PdfExtractor` when `DABOOK_ENABLED=true`. |
| `src/core/rag/DocumentIngester.ts` | In `ingestFile`, when the extracted document has `sections`, map them straight to `DocumentChunk[]` and skip `chunkText`. The embedding flow stays unchanged. |
| `src/core/rag/RAGDocumentStore.ts` | No schema change. Breadcrumbs, pages and quality go into the existing metadata JSON. Check that `buildDeleteChunksForSourceQuery` keeps re-ingests idempotent with the stable IDs. |
| `src/core/native-runtime/RuntimeDiscovery.ts` | Add a `dabook` runtime probe (interpreter found, package importable, version) so it appears in the capability hub (CF-09) with an honest maturity stage. |
| `src/server/routes/knowledge-base.ts` | Add `GET /api/knowledge-base/dabook/health`. Have `/stats` report the extractor in use. Keep the existing `developerOnly` and audit middleware. Path inputs go through `localPathGuard` as they do today. |
| `.env.example` | Add `DABOOK_ENABLED=false`, `DABOOK_PYTHON=`, `DABOOK_WORKSPACE=./data/dabook_workspace`, `DABOOK_PROFILE=balanced`, `DABOOK_TIMEOUT_MS=900000`, `DABOOK_DASHBOARD=false`. |
| `client/` Knowledge panel | Show "Structured (DABOOK)" or "Flat (pdf-parse)" per source, and breadcrumbs and page in citations (`SourcesDrawerFormatter`). |
| `.gitignore` | Add `data/dabook_workspace/` and `services/dabook/.venv/`. |

Retrieval benefits to wire in once chunks carry structure:

- `CitationTracker` and `SourcesDrawerFormatter` show "Book › Chapter › Section, p. 42".
- `HybridRetriever` gets an optional boost for chunks whose breadcrumbs match query terms, and a `hasCode` boost for coding-mode queries.

Tests (Jest):

- `DabookBridge.test.ts`: fake interpreter script covering success, exit codes 2, 3 and 4, timeout, malformed JSON, and schema mismatch.
- `DabookChunkMapper.test.ts`: field mapping and stable IDs.
- `DabookPdfExtractor.test.ts`: fallback to pdf-parse on every failure mode, and the needsOcr flag.
- `DocumentIngester` test: the pre-chunked path skips `chunkText` and still embeds.
- A live test, gated by `DABOOK_LIVE_TEST=1`, that ingests a fixture PDF through `POST /api/knowledge-base/file` and asserts the chunks have breadcrumbs and pages.

**Exit criteria:** with `DABOOK_ENABLED=true`, uploading a technical PDF yields chunks with section and page citations, no header/footer/TOC noise, and stable IDs on re-ingest. With DABOOK disabled or broken, behavior is identical to today plus a warning. `npm run type-check`, `npm test` and `npm run test:dabook` all pass.

### Phase 4: Training-data lane (in scope, 3–4 days)

The Chatbot's `TrainingSeparationCoordinator`, `DatasetLicensePolicy` and `AcademicLicensePolicy` provide the governance. DABOOK provides the corpora. Wire them together **with gates**, because book content is often copyrighted.

The current SFT output is templated and not fit to train on (§2.4). So this phase also does the work that makes the data trainable: LLM-assisted pair generation, dedup and splits. Those items were previously in Phase 5.

**4A. Make the corpora trainable (DABOOK side)**

1. **LLM-assisted SFT generation** (moved from Phase 5.3). Implement the `assist` hook, which is modeled in config but unused, as a new stage `s14_assist_sft` (resource class `llm`, so it runs on the `llm` worker lane).
   - **Input:** each section's prose and code, with breadcrumbs.
   - **Output:** grounded Q&A, explanation and code-walkthrough pairs. Every answer must be supported by the source span. Keep `source_node_ids` and the page range on each pair.
   - **Provider:** Ollama by default (`assist.provider = "ollama:<model>"`), or any OpenAI-compatible endpoint. Responses are cached by prompt hash in `cache/llm`. `assist.max_cost_usd` is enforced for paid providers, and the stage stops cleanly when the budget is exhausted.
   - **Grounding check:** reject a pair when its answer has low token overlap with its source span, or when it introduces code that isn't in the source. Log rejections to `events`.
   - **Keep the heuristic generator** as `sft_heuristic.jsonl` for comparison, but never export it by default.
2. **Dedup.** Apply `dataset.dedup`: exact dedup by normalized-text sha256, and near dedup by MinHash at `jaccard` 0.8. Run it within a book, and across the workspace in `consolidate_workspace_datasets`.
3. **Splits.** Apply `dataset.split` (by chapter or section, with a seeded deterministic assignment) so that no chapter leaks across train, val and test. Write `train/`, `val/` and `test/` JSONL.
4. **Formats.** Add `parquet` and the HF `datasets` layout (the `[export]` extra, `pyarrow`), with a dataset card generated from the manifest. This was previously Phase 5.4.
5. **Per-record provenance** on every training record: `book_sha256`, `license_status`, `source_node_ids`, `pages`, `generator` (`heuristic` or `assist:<model>`), `dabook_version`.

**4B. Governance and export (Chatbot side)**

6. Add `src/core/dabook/TrainingCorpusImporter.ts`. It reads the `sft`/`pretrain`/`code` splits from the contract and registers each record as a `CorpusEntry` (`domain: 'training'`, `contentHash = sha256(text)`). RAG chunks from the same book register as `domain: 'rag'`.
7. **License gate.** Require an explicit license status per book (`owned | permissive | public_domain`), recorded in DABOOK `books.license_status`, which exists but is unused. Set it from the Knowledge UI or `dabook license <book> <status>`. `unknown` or `copyrighted` books are **RAG-only**: the import refuses training registration and gives the reason.
8. **Contamination audit.** Register the `evals/` sets as `domain: 'evaluation'`, then run `runContaminationAudit()` before any export. Block on overlap. The audit result goes into the bundle manifest.
9. **Export endpoint.** Add `POST /api/knowledge-base/dabook/training-export` (developerOnly and audited). Parameters: books, modes, format, split. It writes a governed bundle to `data/training-exports/<timestamp>/`. The manifest records book hashes, licenses, counts per split, the generator mix, dedup stats and the audit result.
10. **Review UI.** A Knowledge panel tab that samples N pairs per book, shows each one next to its source page, and accepts or rejects it. Rejections go back to DABOOK as `edits.jsonl` (the stable node IDs in `core/ids.py` were designed for this). A book's pairs are exportable only after review, or when `quality_score` is at or above `quality.verified`.

**4C. Tests and exit criteria**

- Python: assist stage with a fake provider (cache hit, budget stop, grounding rejection), dedup and split determinism (same seed gives the same split), Parquet/HF round-trip.
- Jest: importer license refusal, contamination block, and export manifest contents.
- **Exit criteria:** On 3 owned or public-domain fixture books, the export produces deduplicated train/val/test bundles in JSONL and Parquet with full provenance. Zero heuristic-template pairs are exported. A spot-check of 50 assisted pairs is at least 90% grounded. A `copyrighted` book can't be exported, through any path.

### Phase 5: Capability upgrades (later, prioritized)

1. **OCR route for scanned PDFs.** Implement `extract.routing.scanned = ocr` with RapidOCR (pure-pip, CPU) by rasterizing with pypdfium2, which is already a dependency, so no Poppler is needed. This also replaces the Chatbot's fragile Poppler/ImageMagick/Ghostscript plus tesseract.js OCR path for PDFs.
2. **Optional Docling backend** for tables and equations (`extract.backend = docling`, extra `[docling]`). Benchmark it against pdfium on the fixture set before enabling it by default.
3. **Typography-based heading detection** (font-size clustering) for PDFs without an outline. Today, books without bookmarks lose most of their structure, which also weakens the chapter-level train/val/test splits in Phase 4. Consider pulling this forward if your library has many books without bookmarks.
4. **EPUB input.** The Chatbot already extracts EPUB, but structure-aware EPUB → Book Graph would follow the same contract.
5. **Fine-tuning hookup.** Feed the Phase 4 bundles into an actual training run (for example, an Unsloth or Axolotl config generated from the bundle manifest), with the result registered through `src/core/learning/ModelUpdater.ts`. This is out of scope until the export lane is proven.

LLM-assisted SFT generation and the Parquet/HF formats moved into Phase 4.

## 5. Running the whole thing (target developer workflow)

Fix git ownership first (Phase 0 step 1). Then:

```bash
npm ci
npm --prefix client ci
npm run setup:dabook
cp .env.example .env
npm run test:dabook
npm run dev
```

In `.env`, set `DABOOK_ENABLED=true` (and `DABOOK_PYTHON` if not using the managed venv). `npm run setup:dabook` creates `services/dabook/.venv` and installs DABOOK.

Standalone DABOOK, for batch processing a library with the live dashboard:

```bash
services/dabook/.venv/Scripts/python -m dabook run "D:/Books" -w data/dabook_workspace --profile balanced
```

The dashboard is at http://127.0.0.1:8765. Chunks produced here are picked up by the Chatbot on its next ingest of the same PDF, as a cache hit.

## 6. Acceptance criteria (overall)

- [ ] `dabook run --no-ui` and `dabook ingest --json` exit by themselves, with no orphan processes, on Windows and Linux.
- [ ] Dashboard Launch, Upload and Watch all process books end to end.
- [ ] Re-running with changed parameters never mixes stale stage outputs (D4, D5, D7 regression tests).
- [ ] A scanned PDF never yields an empty "done". It reaches `needs_input` and appears in the Chatbot OCR queue (and is OCR'd after Phase 5.1).
- [ ] On the fixture set: zero TOC dot-leader chunks, zero header/footer chunks, and more than 90% of chunks carry non-empty breadcrumbs when the PDF has an outline.
- [ ] Chatbot citations show book › section › page for DABOOK-ingested sources.
- [ ] Every DABOOK failure mode falls back to pdf-parse, with a visible warning.
- [ ] Training export is impossible for `unknown` or `copyrighted` books and blocked on eval contamination.
- [ ] Exported training data is LLM-assisted and grounded, deduplicated, split by chapter, carries provenance on every record, and contains zero heuristic-template pairs.
- [ ] CI runs `pytest` (DABOOK), Jest and the type-checks.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Python becomes a hard runtime dependency | Feature flag (`DABOOK_ENABLED`) plus an automatic pdf-parse fallback. The runtime probe shows its status honestly in the capability hub. |
| Long books block the HTTP request | Phase 3 runs synchronously with a timeout, matching today's behavior. Follow-up: run the ingest through `src/core/jobs` and return a job ID, letting the client poll. The DABOOK DB already has progress (`units_done`/`units_total`) to surface. |
| Workspace lock contention (dashboard and Chatbot at once) | Serialize calls in the bridge. `ingest` waits on the lock and returns exit code 4 on timeout. Document that the Chatbot and the standalone dashboard should share one workspace, but only one process should run at a time. |
| Copyright or licensing of book-derived training data | Phase 4 license gate. RAG-only by default. |
| LLM-generated pairs hallucinate beyond the source | Grounding check in `s14_assist_sft`, review UI sampling, and a `generator` provenance field so assisted data can be filtered or audited later. |
| Assisted generation is slow or costly on large libraries | Local Ollama by default, an LLM cache keyed by prompt hash, a cost cap for paid providers, and the `llm` worker lane, so extraction for other books keeps running. |
| Heuristic quality varies by book | Golden-file fixtures across genres, plus the `quality_score` and review gate (D8). |
| Windows specifics (multiprocessing spawn, file locking, UTF-8 console) | Already partly handled in DABOOK (`portalocker`, stdout reconfigure). Add a Windows CI runner for `pytest`. |

## 8. Decisions

Resolved 2026-10-05:

1. **Where DABOOK lives:** vendored in `services/dabook/` in this repo.
2. **Default for `DABOOK_ENABLED`:** `false` until the Phase 3 exit criteria pass.
3. **Training-data lane:** in scope. Phase 4 is a committed deliverable.
4. **Git ownership error:** caused by migrating from an old Windows account. Fix it with an ownership transfer (Phase 0 step 1).

Assumed unless changed:

5. **Workspace location:** `data/dabook_workspace`, alongside `data/chatbot.db`. `DABOOK_WORKSPACE` can point it at an external library directory.
6. **Default assist model:** a local Ollama model. Paid providers stay opt-in, with a cost cap.
