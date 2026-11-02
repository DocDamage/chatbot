# DABOOK

DABOOK turns PDF books into ML-ready datasets. It runs the PDF through a staged, resumable pipeline that extracts the text, removes furniture (running headers, footers, page numbers, table-of-contents pages), restores reading order and rebuilds the chapter/section structure. The output is RAG chunks that carry breadcrumbs and page numbers, plus pretrain, code and (LLM-assisted, grounded) SFT corpora with train/val/test splits.

It's vendored into AI Chatbot Hub as a Python sidecar. For the integration plan and its status, see [`docs/implementation/DABOOK_INTEGRATION_PLAN.md`](../../docs/implementation/DABOOK_INTEGRATION_PLAN.md).

## Setup

From the repository root:

```bash
npm run setup:dabook
npm run test:dabook
```

`setup:dabook` creates `services/dabook/.venv` and installs the package with its dev extras. It uses `uv` when it's available and otherwise falls back to `python -m venv` plus pip. It needs Python 3.11 or newer. To use a specific interpreter, set `DABOOK_PYTHON`.

`test:dabook` takes a few minutes: it includes subprocess tests that start real supervisors and workers. Optional extras: `[export]` (`pyarrow`, for Parquet and Hugging Face output), `[tokens]` (`tiktoken`, exact token counts), `[gpu]`.

## Usage

Run these with the venv's Python. On Windows that's `.venv\Scripts\python`; on other platforms it's `.venv/bin/python`.

| Goal | Command |
| --- | --- |
| Process books and watch the dashboard (http://127.0.0.1:8765) | `python -m dabook run book.pdf -w ../../data/dabook_workspace` |
| Batch mode: exit when done, no dashboard | `python -m dabook run book.pdf -w ws --no-ui` |
| Keep running and pick up new PDFs from `ws/inbox/` and given directories | `python -m dabook run ./library --no-ui --watch -w ws` |
| One-shot ingest with a machine-readable result | `python -m dabook ingest book.pdf -w ws --json` |
| Check the environment | `python -m dabook doctor [--json]` |

`run --no-ui` and `ingest` exit by themselves and leave no processes behind. The dashboard URL printed by `run` carries the API token the Launch and Upload buttons need.

### Headless contract (`dabook ingest --json`)

Writes exactly one JSON document to stdout (`dabook.ingest.v1`, schema in [`schemas/`](schemas/dabook.ingest.v1.schema.json)); logs go to stderr. Dataset paths are relative to the workspace.

| Exit code | Meaning |
| --- | --- |
| 0 | ok |
| 2 | `needs_input`: scanned PDF with no text layer (OCR is not implemented yet) |
| 3 | failed, or stopped by `--timeout-s` with work remaining (re-run to resume) |
| 4 | the workspace is locked by another DABOOK process (`--lock-wait-s` to wait) |
| 5 | bad arguments or invalid configuration |

Re-ingesting the same PDF is a cache hit (typically under a second) and produces identical chunk ids.

## Configuration

Settings come from CLI options and an optional `dabook.toml` in the workspace. Unknown keys and options that are not implemented yet **fail validation** instead of being ignored. Notable settings:

- `dataset.modes` (`raw`, `rag`, `sft`, `pretrain`, `code`), `dataset.formats` (`jsonl`, `parquet`, `hf`), `dataset.chunk_target_tokens` / `chunk_max_tokens`, `dataset.sft_system_prompt`.
- `dataset.dedup` (exact + MinHash near-duplicates, default on) and `dataset.split` (chapter-level train/val/test, default 90/5/5, seed 42).
- `assist.provider`: `none` (default), `ollama:<model>` (local) or `openai:<model>` (paid, OpenAI-compatible; needs `assist.base_url`, `assist.price_per_1k_*` so `assist.max_cost_usd` can be enforced, and the key in the env var named by `assist.api_key_env`).
- `quality.review_gate`: send books below `quality.review` to the `review` state instead of `done`.

## Training data and governance

SFT pairs come from `s13_assist_sft`: a model writes grounded Q&A from each section, and every pair must quote its source, overlap the source vocabulary and contain no code that isn't in the source. Rejections are logged (`rejections.jsonl`, dashboard events). Answers are cached by prompt hash in `<workspace>/cache/llm`, so re-runs and budget top-ups don't pay twice. Template ("heuristic") pairs are written to `sft_heuristic.jsonl` and are **never exported** unless explicitly allowed.

Every training record carries provenance: `book_sha256`, `license_status`, `source_node_ids`, `pages`, `generator`, `dabook_version`.

```bash
python -m dabook ingest book.pdf -w ws --assist ollama:qwen3:8b --modes rag,sft,pretrain,code
python -m dabook license <book> owned            # owned | permissive | public_domain | copyrighted | unknown
python -m dabook review sample <book> -n 20      # pairs next to their source excerpt
python -m dabook review decide <book> <pair_id> reject --reason "answer is wrong"
python -m dabook recompile <book>                # re-runs only the compile stage
python -m dabook review book <book> approved
python -m dabook export --out bundle --modes sft --format jsonl,parquet,hf
```

`dabook export` enforces the rules itself, whoever calls it: only `owned`/`permissive`/`public_domain` books are eligible, a book must be approved or have `quality_score >= quality.verified`, and naming an ineligible book exits `6` with the reasons and writes nothing. `unknown` and `copyrighted` books stay RAG-only.

Each book's outputs go to `<workspace>/books/<sha12>/datasets/` (`splits/<split>/<mode>.jsonl`, optional `parquet/` and `hf/`). Consolidated, cross-book-deduplicated outputs go to `<workspace>/compiled/`.
