---
title: RAG Knowledge Guide
source: docs/rag/03_rag_knowledge_guide.md
section: rag_feeding_rules
tags: [rag, ingestion, documentation, chunking, embeddings]
last_updated: 2026-05-19
authority: canonical
---

# RAG Knowledge Guide

## Purpose

This guide defines what documentation should be fed into the RAG system, how it should be formatted, and what should be avoided.

The goal is to make retrieval precise, grounded, and useful for coding and project assistance.

## Core Rule

Feed the RAG system clean, canonical, source-controlled documentation before feeding it raw notes, giant PDFs, or random exports.

A small set of well-structured Markdown files will usually outperform a huge pile of messy documents.

## Best Formats

Preferred order:

1. Markdown (`.md`)
2. Structured JSON (`.json`)
3. Plain text (`.txt`)
4. Text-based PDF (`.pdf`)
5. CSV/SQLite through `DatasetLoader` when the data is tabular

## Why Markdown Is Preferred

Markdown works well because it provides:

- Clear headings.
- Stable sections.
- Human-readable text.
- Easy source control diffs.
- Better keyword matching.
- Better chunk boundaries once heading-aware chunking is added.

## Standard Document Frontmatter

Use this frontmatter at the top of curated docs:

```yaml
---
title: Document Title
source: docs/rag/example.md
section: main_topic
tags: [tag-one, tag-two]
last_updated: 2026-05-19
authority: canonical
---
```

Even if frontmatter is not parsed into metadata yet, it still helps retrieval because the terms are inside the chunk.

## Recommended Metadata Fields

When using `DocumentManager.addText()` or generating chunks manually, include:

```ts
{
  source: 'docs/rag/example.md',
  title: 'Example Document',
  section: 'important_section',
  type: 'markdown',
  tags: ['rag', 'docs'],
  lastUpdated: '2026-05-19',
  authority: 'canonical'
}
```

## Authority Levels

Use one of these values:

- `canonical` — current source of truth.
- `current` — accurate, but lower authority than canonical.
- `draft` — planning content; not binding.
- `deprecated` — old content kept for history.
- `external` — third-party information.
- `example` — illustrative, not production guidance.

## What To Feed First

### 1. Project Identity Docs

Examples:

- `00_project_brief.md`
- Product overview
- User roles
- Major workflows
- Non-goals

Why:

The chatbot needs to know what the project is and what it is not.

### 2. Architecture Docs

Examples:

- `01_architecture_map.md`
- Module map
- Data flow
- Provider map
- Runtime lifecycle

Why:

This prevents coding agents from wiring systems into the wrong place.

### 3. Module Contracts

Examples:

- `02_module_contracts.md`
- Class responsibilities
- Inputs/outputs
- Safe changes
- Risky changes

Why:

This keeps the repo from turning into a tangled pile of duplicated responsibilities.

### 4. Code Standards

Examples:

- `04_code_standards.md`
- Logging rules
- error handling rules
- testing rules
- TypeScript style rules

Why:

RAG-fed coding agents need local coding rules, not generic advice.

### 5. Setup and Commands

Examples:

- `05_setup_and_commands.md`
- install commands
- build commands
- test commands
- env vars

Why:

Agents need exact commands to verify changes.

### 6. API Reference

Examples:

- `06_api_reference.md`
- endpoints
- request/response shapes
- errors
- auth/session assumptions

Why:

This prevents agents from inventing APIs.

### 7. Data Schemas

Examples:

- `07_data_schemas.md`
- `DocumentChunk`
- `RetrievalResult`
- `RAGResult`
- provider options

Why:

Schemas improve exact-match retrieval and reduce type drift.

### 8. Troubleshooting Knowledge

Examples:

- `08_troubleshooting.md`
- known failures
- symptoms
- likely causes
- fixes

Why:

Troubleshooting docs are highly retrievable because users usually search by symptoms.

### 9. Decision Logs

Examples:

- `09_decision_log.md`
- why providers were chosen
- why Markdown is preferred
- why persistence is future work

Why:

This prevents agents from undoing deliberate decisions.

### 10. Glossary

Examples:

- `10_glossary.md`
- exact meaning of RAG, chunk, embedding, reranker, etc.

Why:

Glossaries help retrieval when terminology varies.

## What Not To Feed

Do not feed:

- `node_modules/`
- build output
- compiled files
- lockfiles as knowledge docs
- giant logs
- random screenshots
- scanned PDFs without OCR
- old docs that contradict current code
- duplicate docs with different answers
- secrets, tokens, API keys, credentials, or private user data
- private production data unless the system is designed and secured for it

## PDF Rules

PDFs are acceptable only when:

- The PDF is text-based.
- Copy/paste from the PDF works.
- The PDF is authoritative.
- The PDF is not full of scanned images.
- The content cannot be better represented as Markdown.

If a PDF fails parsing, the ingester may produce empty or poor text. Convert important PDFs into Markdown when accuracy matters.

## JSON Rules

JSON is good for:

- Structured knowledge entries.
- Configuration explanations.
- Schema catalogs.
- Tool definitions.
- Small reference datasets.

Prefer arrays of focused objects:

```json
[
  {
    "id": "rag-service-contract",
    "title": "RAGService Contract",
    "source": "docs/rag/02_module_contracts.md",
    "authority": "canonical",
    "tags": ["rag", "service", "contract"],
    "content": "RAGService orchestrates query expansion, retrieval, reranking, compression, generation, and citation extraction."
  }
]
```

## CSV Rules

CSV is good for:

- Rows of facts.
- catalogs.
- reference tables.
- test case matrices.

Bad CSV usage:

- giant cells containing unrelated prose.
- rows that mix different entity types.
- columns without clear headers.

## Chunking Rules

Current chunking is basic and text-length based.

Write docs so that a chunk still makes sense if it is cut out of the full file.

Good section pattern:

```md
## Exact Feature Name

Short definition in the first sentence.

Path: `src/core/example/ExactFile.ts`

Responsibilities:
- One
- Two
- Three

Known limits:
- Limit one
```

Bad section pattern:

```md
## Stuff

A long wall of mixed notes about five unrelated modules, old plans, future ideas, and bugs.
```

## Keyword Rules

Because retrieval uses exact and semantic methods, include both:

- Exact names: `RAGService`, `DocumentIngester`, `HybridRetriever`
- Natural language aliases: "RAG orchestrator", "document parser", "hybrid search"
- Paths: `src/core/rag/RAGService.ts`
- Method names: `processQuery()`, `addDocuments()`, `addFile()`

## Recency Rules

When documentation changes:

1. Update `last_updated`.
2. Keep old decisions only if still useful.
3. Mark outdated sections as `deprecated`.
4. Avoid leaving conflicting guidance unmarked.

## Conflict Rules

If two documents conflict:

1. `canonical` wins over `current`.
2. `current` wins over `draft`.
3. Newer `last_updated` wins only when authority is equal.
4. Code wins over docs when docs are stale.
5. Tests win over assumptions.

## Naming Rules

Use stable names:

```txt
docs/rag/00_project_brief.md
docs/rag/01_architecture_map.md
docs/rag/02_module_contracts.md
docs/rag/03_rag_knowledge_guide.md
docs/rag/04_code_standards.md
docs/rag/05_setup_and_commands.md
docs/rag/06_api_reference.md
docs/rag/07_data_schemas.md
docs/rag/08_troubleshooting.md
docs/rag/09_decision_log.md
docs/rag/10_glossary.md
```

## Best Practice

Keep the RAG knowledge base boring, explicit, and current.

The best RAG docs do not sound impressive. They answer exact questions with exact paths, exact responsibilities, and exact limits.