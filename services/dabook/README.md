# DABOOK

DABOOK turns PDF books into ML-ready datasets. It runs the PDF through a staged, resumable pipeline that extracts the text, removes furniture (running headers, footers, page numbers), restores reading order and rebuilds the chapter/section structure. The output is RAG chunks that carry breadcrumbs and page numbers, plus pretrain, SFT and code corpora.

It's vendored into AI Chatbot Hub as a Python sidecar. For the integration roadmap, see [`docs/implementation/DABOOK_INTEGRATION_PLAN.md`](../../docs/implementation/DABOOK_INTEGRATION_PLAN.md).

## Setup

From the repository root:

```bash
npm run setup:dabook
npm run test:dabook
```

`setup:dabook` creates `services/dabook/.venv` and installs the package with its dev extras. It uses `uv` when it's available and otherwise falls back to `python -m venv` plus pip. It needs Python 3.11 or newer. To use a specific interpreter, set `DABOOK_PYTHON`.

## Usage

Run these with the venv's Python. On Windows that's `.venv\Scripts\python`; on other platforms it's `.venv/bin/python`.

To process a book and watch it in the dashboard at http://127.0.0.1:8765:

```bash
python -m dabook run book.pdf -w ../../data/dabook_workspace
```

To process books in batch mode, with no dashboard:

```bash
python -m dabook run book.pdf -w ../../data/dabook_workspace --no-ui
```

To check the environment:

```bash
python -m dabook doctor
```

Each book's outputs go to `<workspace>/books/<sha12>/datasets/`. Consolidated outputs for the whole workspace go to `<workspace>/compiled/`.
