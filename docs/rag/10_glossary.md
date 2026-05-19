---
title: Glossary
source: docs/rag/10_glossary.md
section: glossary
tags: [glossary, terms, rag, retrieval, embeddings]
last_updated: 2026-05-19
authority: canonical
---

# Glossary

## Purpose

This glossary defines common terms used in the chatbot RAG system.

Use these definitions to keep documentation, code comments, and agent prompts consistent.

---

# RAG

RAG means Retrieval-Augmented Generation.

In this project, RAG means the chatbot retrieves relevant project-specific knowledge chunks before generating an answer.

Main files:

- `src/core/rag/RAGService.ts`
- `src/core/rag/HybridRetriever.ts`
- `src/core/rag/DocumentIngester.ts`

---

# Knowledge Base

The knowledge base is the set of documents/chunks available to RAG retrieval.

In the current core RAG flow, documents are added through `RAGService.addDocuments()` or high-level helper methods in `DocumentManager`.

---

# Document

A document is a source file or text entry that can be ingested.

Supported source formats include:

- Markdown
- text
- JSON
- PDF
- CSV through `DatasetLoader`
- SQLite through `DatasetLoader`

---

# DocumentChunk

A `DocumentChunk` is the atomic unit retrieved by the RAG system.

Source type:

```txt
src/types/rag.ts
```

A chunk includes:

- `id`
- `content`
- `metadata`
- optional `embedding`
- optional parent/child chunk references

---

# Chunking

Chunking is the process of splitting a source document into smaller pieces.

Current chunking is basic text-length chunking.

Future improvement:

- heading-aware Markdown chunking
- semantic chunking
- source-span tracking

---

# Chunk Size

Chunk size controls how large each chunk is.

Current default in `DocumentIngester`:

```txt
500
```

Smaller chunks improve precision.

Larger chunks preserve more surrounding context.

---

# Chunk Overlap

Chunk overlap repeats some content between neighboring chunks to avoid losing context at chunk boundaries.

Current default in `DocumentIngester`:

```txt
50
```

---

# Metadata

Metadata is descriptive information attached to a chunk.

Minimum required field:

```txt
source
```

Useful fields:

- `title`
- `section`
- `type`
- `tags`
- `authority`
- `lastUpdated`
- `page`
- `chunkIndex`

---

# Source

Source identifies where a chunk came from.

Examples:

```txt
docs/rag/01_architecture_map.md
manual-entry
data/knowledge.json
Code_Encyclopedia_Master.pdf
```

Source should be stable and human-readable.

---

# Authority

Authority describes how trustworthy or binding a source is.

Recommended values:

- `canonical`
- `current`
- `draft`
- `deprecated`
- `external`
- `example`

---

# Embedding

An embedding is a numeric vector representation of text.

The RAG system uses embeddings for dense semantic retrieval.

Main file:

```txt
src/core/embeddings/EmbeddingService.ts
```

---

# Embedding Provider

An embedding provider creates embeddings.

Supported providers in `EmbeddingService`:

- `xenova`
- `openai`
- `ollama`

Default provider:

```txt
xenova
```

---

# Xenova

Xenova is the default local embedding provider in this project.

Default model:

```txt
Xenova/all-MiniLM-L6-v2
```

Useful because it can run locally without an API key.

---

# OpenAI Embeddings

OpenAI embeddings are API-based embeddings.

They require:

```txt
OPENAI_API_KEY
```

Recommended only when the project is configured to use OpenAI services.

---

# Ollama Embeddings

Ollama embeddings use a local Ollama server.

Default local endpoint:

```txt
http://localhost:11434
```

Recommended model when available:

```txt
nomic-embed-text
```

---

# Dense Retrieval

Dense retrieval uses embeddings and cosine similarity to find semantically related chunks.

Good for:

- paraphrased questions
- conceptual questions
- natural language queries

Weak for:

- exact file paths if docs are poorly written
- exact method names if metadata is missing

---

# BM25 Retrieval

BM25-style retrieval is keyword-based retrieval.

In this project, `HybridRetriever` uses a BM25-like scoring approach through token frequency and inverse document frequency.

Good for:

- exact terms
- paths
- class names
- method names
- config keys

---

# Sparse Retrieval

Sparse retrieval is simple keyword overlap retrieval.

In this project, it uses token overlap/Jaccard-like scoring.

Good for:

- broad keyword matches
- fallback retrieval

---

# Hybrid Retrieval

Hybrid retrieval combines multiple retrieval methods.

In this project:

```txt
BM25 + dense vector retrieval + sparse keyword retrieval
```

Main file:

```txt
src/core/rag/HybridRetriever.ts
```

---

# Query Expansion

Query expansion creates alternative phrasings of the original query.

Main file:

```txt
src/core/rag/QueryExpander.ts
```

Purpose:

- Improve recall.
- Find documents even when the user uses different wording.

Risk:

- Bad expansions can retrieve irrelevant docs.

---

# Reranking

Reranking reorders retrieved chunks after initial retrieval.

Main file:

```txt
src/core/rag/ReRanker.ts
```

Current reranking is heuristic.

It considers:

- query term overlap
- chunk length
- term position
- metadata title/section matches

---

# Cross-Encoder

A cross-encoder is a model that scores a query and document together.

Important note:

The current `ReRanker` is not a true transformer cross-encoder. It is a heuristic reranker.

---

# Context Compression

Context compression reduces retrieved chunks into shorter context before answer generation.

Main file:

```txt
src/core/rag/ContextCompressor.ts
```

Compression can be LLM-based or fallback truncation.

---

# CompressedContext

`CompressedContext` is the result of compressing retrieved chunks.

It includes:

- original chunks
- compressed content
- compression ratio
- preserved chunks

---

# Citation

A citation links a generated response back to a source chunk.

Main file:

```txt
src/core/rag/CitationTracker.ts
```

Citations are approximate unless stronger source-span tracking is added.

---

# CitationTracker

`CitationTracker` extracts citations from the final response and retrieved chunks.

It estimates relevance based on overlap between answer text and chunk content.

---

# LLMAdapter

`LLMAdapter` is the abstraction used to call a language model.

RAG uses it for:

- query expansion
- context compression
- final response generation

---

# DocumentIngester

`DocumentIngester` parses files and text into `DocumentChunk[]`.

Main file:

```txt
src/core/rag/DocumentIngester.ts
```

Supported direct formats:

- `.txt`
- `.md`
- `.json`
- `.pdf`

---

# DocumentManager

`DocumentManager` is the high-level API for adding files, text, and directories to RAG.

Main file:

```txt
src/core/rag/DocumentManager.ts
```

Primary methods:

- `addFile()`
- `addText()`
- `addDirectory()`

---

# DatasetLoader

`DatasetLoader` loads structured datasets into chunks.

Main file:

```txt
src/core/knowledge/DatasetLoader.ts
```

Supported structured sources:

- CSV
- JSON
- SQLite

---

# Canonical Document

A canonical document is a source-of-truth document.

Canonical docs should win over draft notes when there is a conflict.

The RAG docs under `docs/rag/` are intended to be canonical unless marked otherwise.

---

# Draft Document

A draft document contains planning or incomplete ideas.

Drafts should not be treated as final implementation truth.

---

# Deprecated Document

A deprecated document is old and should not guide new implementation.

Deprecated docs may remain for historical reference but should not be preferred in retrieval.

---

# Semantic Cache

A semantic cache stores responses or results by semantic similarity instead of exact string equality.

Related config:

```env
ENABLE_SEMANTIC_CACHE=true
```

---

# Model Routing

Model routing selects an appropriate model/provider for a given task.

Related config:

```env
ENABLE_MODEL_ROUTING=true
```

---

# Safety Pipeline

The safety pipeline checks or mitigates generated responses.

Related config:

```env
ENABLE_SAFETY_PIPELINE=true
```

---

# Grounding

Grounding means the answer is based on retrieved source context instead of unsupported model memory.

A grounded answer should be traceable to chunks and citations.

---

# Hallucination

A hallucination is an answer that invents information not supported by the available context or reliable source documents.

RAG reduces hallucination risk but does not eliminate it.

---

# Retrieval Recall

Recall means the retriever found most or all relevant chunks.

Query expansion and hybrid retrieval improve recall.

---

# Retrieval Precision

Precision means the retrieved chunks are actually relevant.

Focused docs, metadata, and reranking improve precision.

---

# Source Span

A source span is the exact position in a source document that supports a claim.

Examples:

- line range
- page number
- character start/end
- heading section

Future citation upgrades should track source spans more precisely.

---

# Persistent Vector Store

A persistent vector store saves documents and embeddings across restarts.

The current core should not be described as persistent unless a durable store is wired into the active pipeline.

Potential future options:

- SQLite
- Chroma
- LanceDB
- PostgreSQL with pgvector

---

# Reindexing

Reindexing means rebuilding the knowledge base after docs, chunks, or embedding models change.

Reindex when:

- changing embedding model
- changing chunking logic
- changing canonical docs
- clearing stale documents

---

# Frontmatter

Frontmatter is metadata at the top of a Markdown document.

Example:

```yaml
---
title: Architecture Map
source: docs/rag/01_architecture_map.md
authority: canonical
---
```

Future ingestion should parse frontmatter into `DocumentChunk.metadata`.

---

# Heading-Aware Chunking

Heading-aware chunking splits Markdown based on headings instead of plain text length.

This is a recommended future upgrade because it preserves section meaning better than raw word splitting.

---

# Ingestion

Ingestion is the process of reading source content and turning it into chunks.

Main files:

- `DocumentIngester.ts`
- `DocumentManager.ts`
- `DatasetLoader.ts`

---

# Retrieval

Retrieval is the process of finding chunks relevant to a query.

Main file:

```txt
src/core/rag/HybridRetriever.ts
```

---

# Generation

Generation is the process of using an LLM to produce a final answer.

In RAG, generation should happen after retrieval and context compression.

---

# Final Rule

When in doubt, use exact project terms, exact file paths, and short definitions. That makes the RAG system more reliable.