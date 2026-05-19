---
title: Decision Log
source: docs/rag/09_decision_log.md
section: decision_log
tags: [decisions, architecture, rag, documentation]
last_updated: 2026-05-19
authority: canonical
---

# Decision Log

## Purpose

This document records important RAG and knowledge-base decisions so future work does not repeatedly reopen settled choices.

Each entry should explain the decision, why it was made, what was rejected, and what would justify revisiting it.

---

# 2026-05-19 — Use Markdown As The Primary RAG Documentation Format

## Status

Accepted

## Decision

Curated Markdown files in `docs/rag/` are the preferred source format for canonical RAG knowledge.

## Reason

Markdown is:

- human-readable
- source-control friendly
- easy to chunk
- easy to search by exact keyword
- easy to organize with headings
- better than raw planning dumps for retrieval

## Rejected Alternatives

### Giant PDF Knowledge Dump

Rejected because PDF extraction can be unreliable, especially for scanned or complex-layout PDFs.

### Raw Notes Folder

Rejected because raw notes often contain contradictions, drafts, and stale ideas.

### Code-Only Knowledge

Rejected because code explains implementation but not intent, decisions, or safe modification boundaries.

## Revisit If

- A stronger structured knowledge extraction pipeline is implemented.
- Markdown heading-aware chunking is replaced by a richer document parser.
- A durable knowledge store with source authority scoring is added.

---

# 2026-05-19 — Keep RAG Knowledge Docs Under `docs/rag/`

## Status

Accepted

## Decision

Canonical RAG documentation should live in:

```txt
docs/rag/
```

## Reason

A dedicated folder makes it easy to ingest a known documentation set, audit source authority, and prevent random project files from polluting the knowledge base.

## Rejected Alternatives

### Spread Docs Across The Repo

Rejected because ingestion becomes less predictable and stale docs are harder to avoid.

### Store Docs Only In Code Comments

Rejected because code comments are not enough for architecture, setup, troubleshooting, and decisions.

## Revisit If

- A recursive ingestion system with strong ignore patterns and authority filters is added.

---

# 2026-05-19 — Feed Canonical Docs Before Drafts

## Status

Accepted

## Decision

Canonical docs should be ingested before draft/planning docs.

## Reason

The current retrieval system does not fully resolve source conflicts by authority. If draft and canonical docs conflict, RAG may retrieve the wrong one unless the source set is curated.

## Rejected Alternatives

### Ingest Everything And Let Retrieval Sort It Out

Rejected because current retrieval/reranking does not reliably distinguish authoritative current facts from old planning notes.

## Revisit If

- Source authority scoring is implemented.
- Conflict detection is implemented.
- Deprecated/draft filtering is implemented.

---

# 2026-05-19 — Preserve Exact Keyword Retrieval

## Status

Accepted

## Decision

The RAG system should preserve exact keyword retrieval alongside dense semantic retrieval.

## Reason

This repo needs exact matching for:

- file paths
- class names
- method names
- environment variables
- error messages
- endpoint names
- configuration keys

Dense retrieval alone may miss exact technical identifiers.

## Rejected Alternatives

### Dense-Only Retrieval

Rejected because semantic embeddings can weaken exact path/class matching.

### Keyword-Only Retrieval

Rejected because semantic questions may use different wording from the docs.

## Revisit If

- A better hybrid retriever is implemented, but it must still support exact technical matching.

---

# 2026-05-19 — Treat The Current Reranker As Heuristic, Not A True Cross-Encoder

## Status

Accepted

## Decision

The current `ReRanker` should be documented and treated as a heuristic reranker.

## Reason

It scores term overlap, length, term position, and metadata. It does not currently run a transformer cross-encoder model.

## Rejected Alternatives

### Claim It Is A True Cross-Encoder

Rejected because that would mislead future developers and overstate implementation quality.

## Revisit If

- A real cross-encoder or reranking model is added behind the existing interface.

---

# 2026-05-19 — Use Xenova As The Local-First Default Embedding Provider

## Status

Accepted

## Decision

Use Xenova local embeddings as the default baseline.

Default model:

```txt
Xenova/all-MiniLM-L6-v2
```

## Reason

The current `EmbeddingService` defaults to Xenova. It is local-first and does not require an API key.

## Rejected Alternatives

### OpenAI-Only Embeddings

Rejected because they require an API key and external service dependency.

### Ollama-Only Embeddings

Rejected because it assumes a local Ollama setup and model availability.

## Revisit If

- A project-wide provider setting chooses a different default.
- A persistent vector store is added and standardized around another embedding dimension/model.

---

# 2026-05-19 — Do Not Trust Raw PDF Ingestion For Critical Knowledge

## Status

Accepted

## Decision

PDFs may be ingested, but critical knowledge should be converted to Markdown when accuracy matters.

## Reason

PDF parsing can fail or produce poor chunks, especially with scanned/image-only PDFs and complex layouts.

## Rejected Alternatives

### Use PDFs As The Primary Knowledge Source

Rejected because extraction quality is unstable.

## Revisit If

- OCR and layout-aware PDF extraction are added.
- Per-page source spans are implemented.

---

# 2026-05-19 — Keep RAG Documentation Boring And Explicit

## Status

Accepted

## Decision

RAG docs should prioritize exactness over style.

Good RAG docs include:

- exact paths
- exact class names
- method names
- concise definitions
- current limits
- safe/risky changes
- troubleshooting symptoms

## Reason

The current retrieval system benefits from explicit terms and focused sections.

## Rejected Alternatives

### Vague Narrative Documentation

Rejected because it retrieves poorly and encourages hallucinated answers.

### Overly Abstract Architecture Docs

Rejected because coding agents need concrete file paths and boundaries.

## Revisit If

- The retrieval stack becomes much more advanced, but exact technical docs should still remain.

---

# 2026-05-19 — Treat Persistence As Future Work Unless Confirmed Implemented

## Status

Accepted

## Decision

Do not describe the current RAG knowledge base as durable/persistent unless a persistent store is actually wired into the active pipeline.

## Reason

The scanned RAG core stores documents in memory through `HybridRetriever`. Future code may add persistence, but docs must not overstate the current state.

## Rejected Alternatives

### Assume Vector Persistence Exists

Rejected because misleading docs cause bad setup and debugging guidance.

## Revisit If

- SQLite persistence is added.
- Chroma/LanceDB/pgvector is wired into the live retriever.
- Startup indexing and file hash tracking are implemented.

---

# 2026-05-19 — Use Authority Metadata For Future Conflict Resolution

## Status

Accepted

## Decision

Docs and chunks should include authority labels when possible.

Recommended labels:

- `canonical`
- `current`
- `draft`
- `deprecated`
- `external`
- `example`

## Reason

The current retrieval system may retrieve stale or draft docs. Authority metadata gives future rerankers and filters a way to prefer correct sources.

## Rejected Alternatives

### Rely Only On File Dates

Rejected because newer docs are not always more authoritative.

### Rely Only On File Names

Rejected because naming conventions drift.

## Revisit If

- Authority-aware filtering is implemented and a stronger schema is adopted.

---

# Decision Entry Template

Use this template for new decisions:

```md
# YYYY-MM-DD — Decision Title

## Status

Proposed | Accepted | Rejected | Deprecated | Superseded

## Decision

State the decision plainly.

## Reason

Explain why this was chosen.

## Rejected Alternatives

Explain what was considered and why it was rejected.

## Revisit If

State what would justify changing the decision.
```

## Maintenance Rule

When architecture changes, update this file in the same change set as the code or documentation that depends on the decision.