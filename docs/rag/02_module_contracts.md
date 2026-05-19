---
title: Module Contracts
source: docs/rag/02_module_contracts.md
section: module_contracts
tags: [contracts, modules, rag, boundaries]
last_updated: 2026-05-19
authority: canonical
---

# Module Contracts

## Purpose

This document defines what each RAG module owns, what it must not own, and how coding agents should modify the system without creating tangled responsibilities.

## Global Rule

Each RAG module should do one job and expose a narrow contract.

Do not move orchestration, parsing, retrieval, reranking, compression, citation extraction, and provider logic into one giant service.

---

# `RAGService`

Path: `src/core/rag/RAGService.ts`

## Responsibility

Orchestrates the full RAG query pipeline.

## Owns

- Query processing flow.
- Calling query expansion.
- Calling retrieval.
- Deduplicating retrieval results.
- Calling reranking.
- Calling context compression.
- Calling the LLM adapter when response generation is requested.
- Calling citation extraction.
- Returning `RAGResult`.

## Inputs

- `query: string`
- `generateResponse: boolean`
- `DocumentChunk[]` through `addDocuments()`

## Outputs

- `RAGResult`

## Must Not Own

- File parsing.
- PDF parsing.
- CSV/JSON/SQLite dataset loading.
- Embedding provider internals.
- UI concerns.
- Long-term persistence implementation.
- Source document cleanup.

## Safe Changes

- Add telemetry around pipeline stages.
- Add configuration for retrieval count, rerank count, and compression length.
- Add guards for empty knowledge base.
- Add better error handling around failed expansion/compression/generation.

## Risky Changes

- Changing result shape without updating consumers.
- Hardcoding one provider.
- Mixing ingestion logic into the service.
- Removing citation metadata.

---

# `DocumentIngester`

Path: `src/core/rag/DocumentIngester.ts`

## Responsibility

Read documents and convert them into `DocumentChunk[]`.

## Owns

- Reading `.txt` files.
- Reading `.md` files.
- Reading `.json` files.
- Reading `.pdf` files with `pdf-parse`.
- Fallback text reading.
- Basic chunking.
- Optional embedding generation for chunks.

## Inputs

- File path.
- Raw text.
- Directory path.
- `IngestOptions`.

## Outputs

- `DocumentChunk[]`

## Must Not Own

- Final answer generation.
- Query expansion.
- Retrieval ranking.
- UI behavior.
- Long-term vector persistence.
- Deciding whether an answer is correct.

## Safe Changes

- Add Markdown heading-aware chunking.
- Parse frontmatter into metadata.
- Add recursive directory ingestion behind an option.
- Add ignore patterns.
- Add source hashing.
- Improve chunk metadata.

## Risky Changes

- Changing chunk ids without migration logic.
- Swallowing parse errors without metadata.
- Treating scanned PDFs as reliable text.

---

# `DocumentManager`

Path: `src/core/rag/DocumentManager.ts`

## Responsibility

Provide a high-level API for adding knowledge to the RAG service.

## Owns

- `addFile()`
- `addText()`
- `addDirectory()`
- Passing ingested chunks into `RAGService.addDocuments()`
- Basic stats exposure

## Inputs

- File path.
- Directory path.
- Raw text plus metadata.
- Options for embeddings and chunk size.

## Outputs

- `DocumentChunk[]`

## Must Not Own

- Parsing internals.
- Retrieval internals.
- LLM response generation.
- UI upload state.

## Safe Changes

- Add progress callbacks.
- Add batch ingestion summaries.
- Add error aggregation for directory ingestion.
- Add config defaults.

## Risky Changes

- Hiding ingestion failures.
- Adding documents without source metadata.

---

# `HybridRetriever`

Path: `src/core/rag/HybridRetriever.ts`

## Responsibility

Retrieve relevant `DocumentChunk` entries using a hybrid strategy.

## Owns

- In-memory document list.
- BM25-style index rebuild.
- Dense cosine-similarity retrieval.
- Sparse keyword/Jaccard retrieval.
- Combining weighted retrieval results.

## Inputs

- Query string.
- Top-K count.
- Retrieval weights.
- `DocumentChunk[]` added through `addDocuments()`.

## Outputs

- `RetrievalResult[]`

## Must Not Own

- File ingestion.
- Query expansion.
- Context compression.
- Final LLM generation.
- Citation formatting.

## Safe Changes

- Tune weights.
- Normalize scores more carefully.
- Add minimum score thresholds.
- Add metadata filtering.
- Add source authority weighting.
- Add persistent backing store behind the same interface.

## Risky Changes

- Removing keyword retrieval, because exact paths/classes need exact matching.
- Removing dense retrieval, because semantic search depends on it.
- Changing scoring without tests.

---

# `QueryExpander`

Path: `src/core/rag/QueryExpander.ts`

## Responsibility

Generate alternate versions of the user query to improve retrieval.

## Owns

- LLM-based query expansion.
- Simple fallback query expansion.

## Inputs

- Original query.
- Number of expansions.

## Outputs

- `QueryExpansion`

## Must Not Own

- Document retrieval.
- Reranking.
- Final answers.
- Source authority decisions.

## Safe Changes

- Improve parsing of numbered LLM output.
- Add domain-specific synonyms.
- Include original query in all expansion results.
- Add max query length limits.

## Risky Changes

- Returning only paraphrases and dropping exact original terms.
- Generating too many broad queries.

---

# `ReRanker`

Path: `src/core/rag/ReRanker.ts`

## Responsibility

Rerank candidate retrieved chunks.

## Owns

- Term-overlap scoring.
- Length scoring.
- Position scoring.
- Metadata/title/section scoring.

## Inputs

- Original query.
- Retrieval results.
- Top-K count.

## Outputs

- Reranked `RetrievalResult[]`

## Must Not Own

- Initial retrieval.
- Context compression.
- Citation extraction.
- LLM answer generation.

## Safe Changes

- Add metadata authority score.
- Add recency score when metadata has dates.
- Add source-type score.
- Replace heuristic scoring with a real cross-encoder behind the same public method.

## Risky Changes

- Penalizing short factual chunks too heavily.
- Ignoring metadata.

---

# `ContextCompressor`

Path: `src/core/rag/ContextCompressor.ts`

## Responsibility

Reduce retrieved context while preserving query-relevant facts.

## Owns

- Combining selected chunks.
- LLM-based compression.
- Truncation fallback.
- Returning `CompressedContext`.

## Inputs

- `DocumentChunk[]`
- Query string.

## Outputs

- `CompressedContext`

## Must Not Own

- Retrieval.
- Reranking.
- Citation scoring.
- Source ingestion.

## Safe Changes

- Preserve source markers during compression.
- Add configurable max length.
- Add chunk-by-chunk extractive compression.
- Add quote/span preservation for citation reliability.

## Risky Changes

- Compressing away file paths, section names, or hard facts.
- Summarizing conflicting sources as if they agree.

---

# `CitationTracker`

Path: `src/core/rag/CitationTracker.ts`

## Responsibility

Connect generated responses back to source chunks.

## Owns

- Relevance estimation between answer and chunks.
- Relevant snippet extraction.
- Citation formatting.

## Inputs

- Response text.
- Retrieved/reranked chunks.

## Outputs

- `Citation[]`
- Formatted citation text.

## Must Not Own

- Initial retrieval.
- Compression.
- Deciding final answer content.

## Safe Changes

- Add exact source markers.
- Add line/span references if available.
- Improve snippet extraction.
- Prefer canonical source metadata.

## Risky Changes

- Returning citations for chunks with weak overlap.
- Dropping source path/title.

---

# `EmbeddingService`

Path: `src/core/embeddings/EmbeddingService.ts`

## Responsibility

Generate embedding vectors from text.

## Owns

- OpenAI embedding calls.
- Xenova local embedding calls.
- Ollama embedding calls.
- Provider fallback behavior.
- Batch embedding generation.

## Inputs

- Text string.
- Optional provider/model configuration.

## Outputs

- `number[]`
- `number[][]`

## Must Not Own

- Document chunking.
- Retrieval ranking.
- Response generation.

## Safe Changes

- Add provider health checks.
- Add batching/concurrency limits.
- Add model-specific dimension validation.
- Cache embeddings by text hash.

## Risky Changes

- Mixing embedding dimensions in the same vector collection.
- Silently falling back to a model with different dimensions without reindexing.

---

# `DatasetLoader`

Path: `src/core/knowledge/DatasetLoader.ts`

## Responsibility

Load structured datasets into `DocumentChunk[]`.

## Owns

- CSV loading.
- JSON loading.
- SQLite table loading.
- Formatting rows/items as readable text.
- Structured metadata such as row ranges, item ranges, source type, and table name.

## Inputs

- CSV path.
- JSON path.
- SQLite database path and table name.
- Dataset options.

## Outputs

- `DocumentChunk[]`

## Must Not Own

- General file ingestion.
- Final RAG orchestration.
- Answer generation.

## Safe Changes

- Add column selection.
- Add schema descriptions.
- Add row-level chunking modes.
- Add metadata filters.

## Risky Changes

- Flattening structured data so much that field names are lost.
- Chunking rows from unrelated entities together.

---

# Coding Agent Rules

When modifying RAG:

1. Preserve public interfaces unless deliberately migrating consumers.
2. Add tests before changing retrieval scoring.
3. Keep file parsing in ingestion modules.
4. Keep answer generation in orchestration or higher-level layers.
5. Do not remove exact keyword retrieval.
6. Do not feed raw docs without source metadata.
7. Do not mix canonical docs with draft notes without an authority marker.