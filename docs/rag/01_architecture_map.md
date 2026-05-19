---
title: Architecture Map
source: docs/rag/01_architecture_map.md
section: architecture
tags: [architecture, rag, data-flow, modules]
last_updated: 2026-05-19
authority: canonical
---

# Architecture Map

## Purpose

This document maps the current RAG architecture so humans and coding agents know where each responsibility belongs.

## Core RAG Folder

Path: `src/core/rag/`

Primary files:

- `RAGService.ts` — orchestrates the full RAG flow.
- `DocumentIngester.ts` — reads supported files and chunks text.
- `DocumentManager.ts` — high-level API for adding files, directories, and text.
- `HybridRetriever.ts` — combines BM25-style retrieval, dense vector retrieval, and sparse keyword retrieval.
- `QueryExpander.ts` — generates alternative query phrasings.
- `ReRanker.ts` — reranks retrieved chunks with heuristic scoring.
- `ContextCompressor.ts` — compresses retrieved chunks before final generation.
- `CitationTracker.ts` — extracts and formats citations from retrieved chunks.

## Supporting Types

Path: `src/types/rag.ts`

Important interfaces:

- `DocumentChunk`
- `RetrievalResult`
- `QueryExpansion`
- `CompressedContext`
- `Citation`

## Embedding Layer

Path: `src/core/embeddings/EmbeddingService.ts`

Supported providers:

- `xenova` — default local provider.
- `openai` — API-based provider when an OpenAI key is configured.
- `ollama` — local Ollama endpoint provider.

Default model:

- `Xenova/all-MiniLM-L6-v2`

## Knowledge/Data Loading Layer

Path: `src/core/knowledge/`

Important file:

- `DatasetLoader.ts` — loads structured data from CSV, JSON, and SQLite into `DocumentChunk` objects.

Useful for:

- Tables.
- Reference datasets.
- Catalogs.
- Structured documentation.
- Knowledge entries that should preserve row/item metadata.

## Recommended RAG Data Flow

```text
Document source
  -> DocumentIngester or DatasetLoader
  -> DocumentChunk[]
  -> Optional embeddings through EmbeddingService
  -> RAGService.addDocuments()
  -> HybridRetriever.addDocuments()
  -> Query comes in
  -> QueryExpander.expandQuery()
  -> HybridRetriever.retrieve()
  -> ReRanker.rerank()
  -> ContextCompressor.compress()
  -> LLMAdapter.generate()
  -> CitationTracker.extractCitations()
  -> RAGResult
```

## Runtime Query Flow

1. `RAGService.processQuery(query, generateResponse)` receives the user query.
2. `QueryExpander` creates alternate versions of the query.
3. `HybridRetriever` retrieves chunks for each expanded query.
4. Results are deduplicated by chunk id.
5. `ReRanker` selects the top chunks.
6. `ContextCompressor` reduces context size.
7. If `generateResponse` is true, the LLM answers from compressed context.
8. `CitationTracker` attempts to connect response content back to source chunks.
9. `RAGResult` returns the answer, citations, retrieved chunks, compressed context, and metadata.

## Ingestion Flow

### File Ingestion

Use `DocumentManager.addFile(filePath, options)`.

Good for:

- One Markdown guide.
- One text document.
- One JSON file.
- One text-based PDF.

### Directory Ingestion

Use `DocumentManager.addDirectory(directoryPath, options)`.

Current limitation:

- Directory ingestion reads direct files in the folder. Treat it as shallow unless implementation is upgraded for recursive traversal.

### Text Ingestion

Use `DocumentManager.addText(text, metadata, options)`.

Best for:

- Generated knowledge entries.
- User-provided notes.
- Manually curated snippets.
- Runtime memory entries.

## Retrieval Components

### BM25-Style Retrieval

Current file: `HybridRetriever.ts`

Purpose:

- Helps exact keywords, class names, file names, and terms match reliably.

Documentation implication:

- Use exact paths, exact type names, exact methods, and repeated aliases.

### Dense Vector Retrieval

Current file: `HybridRetriever.ts`

Purpose:

- Helps semantic matches when wording differs.

Documentation implication:

- Write natural explanations, not only bullet lists.

### Sparse Keyword Retrieval

Current file: `HybridRetriever.ts`

Purpose:

- Helps simple overlap-based keyword discovery.

Documentation implication:

- Include important terms in headings and first sentences.

## Reranking Implications

`ReRanker` rewards:

- Query terms present in chunk content.
- Medium-length chunks.
- Query terms appearing early.
- Query/title matches.
- Query/section matches.

Therefore:

- Put key terms near the start of each section.
- Use specific section headings.
- Do not bury the important answer at the bottom of a long file.

## Compression Implications

`ContextCompressor` defaults to a small compressed context. Long retrieved content may be summarized or truncated.

Therefore:

- Keep each section focused.
- Avoid mixing unrelated systems in one section.
- Prefer several small canonical documents over one giant document.

## Citation Implications

`CitationTracker` uses chunk metadata and response/chunk overlap to identify citations.

Therefore:

- Set `metadata.source` consistently.
- Set `metadata.title` when possible.
- Keep source-specific facts close together.
- Avoid copying the same paragraph into multiple files.

## Known Architecture Limits

Current limits to keep in mind:

- No confirmed persistent vector database in the current RAG core.
- No recursive directory ingestion unless added later.
- PDF parsing depends on text extraction quality.
- Reranking is heuristic, not a true transformer cross-encoder.
- Citation tracking is approximate.
- Conflicting docs are not automatically reconciled.

## Upgrade Targets

Recommended future architecture upgrades:

1. Recursive directory ingestion with ignore patterns.
2. Frontmatter parsing into `DocumentChunk.metadata`.
3. Heading-aware Markdown chunking.
4. Persistent vector storage using SQLite, Chroma, LanceDB, pgvector, or another durable store.
5. File hash tracking for incremental reindexing.
6. Source authority scoring.
7. Conflict detection between canonical and draft docs.
8. Better citation grounding with source-span references.
9. Test coverage for full ingestion-to-answer flow.