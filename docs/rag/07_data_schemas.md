---
title: Data Schemas
source: docs/rag/07_data_schemas.md
section: data_schemas
tags: [schemas, typescript, rag, document-chunk, retrieval]
last_updated: 2026-05-19
authority: canonical
---

# Data Schemas

## Purpose

This document defines the core data structures used by the RAG system.

Use this as the canonical reference when modifying RAG types, ingestion output, retrieval output, or citations.

---

# `DocumentChunk`

Source type file: `src/types/rag.ts`

## Purpose

A `DocumentChunk` is the atomic knowledge unit used by retrieval.

Every ingested document is split into one or more chunks.

## Schema

```ts
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    title?: string;
    author?: string;
    date?: Date;
    page?: number;
    section?: string;
    [key: string]: any;
  };
  embedding?: number[];
  parentId?: string;
  childrenIds?: string[];
}
```

## Required Fields

### `id`

Stable chunk id.

Current examples:

```txt
{source}-chunk-{index}
csv_{filename}_chunk_{index}
json_{filename}_chunk_{index}
sqlite_{tableName}_chunk_{index}
```

### `content`

The actual text to retrieve and send into context.

Good content:

- focused
- readable
- self-contained
- includes exact names and natural explanation

Bad content:

- huge unrelated walls of text
- raw binary/garbled PDF extraction
- content without headings or source context

### `metadata.source`

Canonical source identifier.

Examples:

```txt
docs/rag/01_architecture_map.md
manual-entry
data/knowledge.json
Code_Encyclopedia_Master.pdf
```

## Recommended Metadata Fields

```ts
metadata: {
  source: 'docs/rag/01_architecture_map.md',
  title: 'Architecture Map',
  section: 'rag_architecture',
  type: 'markdown',
  tags: ['rag', 'architecture'],
  authority: 'canonical',
  lastUpdated: '2026-05-19',
  chunkIndex: 0,
  startChar: 0,
  endChar: 500
}
```

## Authority Metadata

Recommended values:

```ts
type Authority = 'canonical' | 'current' | 'draft' | 'deprecated' | 'external' | 'example';
```

## Type Metadata

Recommended values:

```ts
type SourceType = 'markdown' | 'text' | 'json' | 'pdf' | 'csv' | 'sqlite' | 'manual';
```

## Embedding Field

```ts
embedding?: number[]
```

This field stores the vector representation for dense retrieval.

Rules:

- Do not mix embedding dimensions in the same active vector index.
- Reindex when changing embedding model.
- Track provider/model in metadata when persistence is added.

Recommended future metadata:

```ts
embeddingProvider: 'xenova',
embeddingModel: 'Xenova/all-MiniLM-L6-v2',
embeddingDimensions: 384
```

---

# `RetrievalResult`

Source type file: `src/types/rag.ts`

## Purpose

Represents one retrieved chunk and its score.

## Schema

```ts
export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  retrievalMethod: 'bm25' | 'dense' | 'sparse' | 'hybrid';
}
```

## Fields

### `chunk`

The matched `DocumentChunk`.

### `score`

Relative relevance score.

Do not treat scores as universal probabilities.

A score is only meaningful within the same retrieval run and scoring method.

### `retrievalMethod`

Current allowed values:

- `bm25`
- `dense`
- `sparse`
- `hybrid`

Note:

Some internal merged results may combine labels as strings like `bm25+dense`. If keeping strict TypeScript types, update the schema to support combined methods.

Recommended future type:

```ts
type RetrievalMethod = 'bm25' | 'dense' | 'sparse' | 'hybrid' | string;
```

---

# `QueryExpansion`

Source type file: `src/types/rag.ts`

## Purpose

Stores the original query and alternate retrieval queries.

## Schema

```ts
export interface QueryExpansion {
  originalQuery: string;
  expandedQueries: string[];
  reasoning: string;
}
```

## Rules

- Always preserve the original query or include it in expanded queries.
- Do not generate broad unrelated queries.
- Keep expansions complete enough for retrieval.

## Example

```ts
{
  originalQuery: 'What docs should I feed RAG?',
  expandedQueries: [
    'What docs should I feed RAG?',
    'Which documentation formats work best for the knowledge base?',
    'How should documents be structured for retrieval?'
  ],
  reasoning: 'Expanded using RAG documentation terminology.'
}
```

---

# `CompressedContext`

Source type file: `src/types/rag.ts`

## Purpose

Represents retrieved context after compression or truncation.

## Schema

```ts
export interface CompressedContext {
  originalChunks: DocumentChunk[];
  compressedContent: string;
  compressionRatio: number;
  preservedChunks: DocumentChunk[];
}
```

## Fields

### `originalChunks`

Chunks passed into compression.

### `compressedContent`

Text sent to the final answer prompt or returned as context.

### `compressionRatio`

Compressed length divided by original length.

### `preservedChunks`

Chunks believed to be preserved after compression.

## Rules

- Preserve hard facts.
- Preserve file paths.
- Preserve class names.
- Preserve source markers where possible.
- Do not summarize conflicts as agreement.

---

# `Citation`

Source type file: `src/types/rag.ts`

## Purpose

Represents a link between generated response content and a source chunk.

## Schema

```ts
export interface Citation {
  chunkId: string;
  source: string;
  content: string;
  relevance: number;
  metadata: Record<string, any>;
}
```

## Fields

### `chunkId`

The id of the cited chunk.

### `source`

The source path or source label.

### `content`

Relevant snippet extracted from the chunk.

### `relevance`

Approximate relevance score.

### `metadata`

Source metadata copied from the chunk.

## Rules

- Prefer source title and path.
- Preserve page/section if available.
- Avoid citations with weak relevance.
- Add line/span references in future upgrades if possible.

---

# `RAGResult`

Source file: `src/core/rag/RAGService.ts`

## Purpose

Top-level response from `RAGService.processQuery()`.

## Schema

```ts
export interface RAGResult {
  response: string;
  citations: Citation[];
  retrievedChunks: DocumentChunk[];
  compressedContext: string;
  metadata: {
    retrievalMethod: string;
    compressionRatio: number;
    numChunksRetrieved: number;
  };
}
```

## Fields

### `response`

Final answer or compressed context, depending on `generateResponse`.

### `citations`

Citation objects extracted from generated answer and retrieved chunks.

### `retrievedChunks`

Final reranked chunks used for context.

### `compressedContext`

Compressed knowledge passed to the LLM.

### `metadata`

Pipeline metadata.

## Recommended Future Metadata

```ts
metadata: {
  retrievalMethod: 'hybrid',
  compressionRatio: 0.42,
  numChunksRetrieved: 10,
  numChunksReranked: 5,
  queryExpansionCount: 3,
  embeddingProvider: 'xenova',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  generatedAt: '2026-05-19T00:00:00Z'
}
```

---

# `IngestOptions`

Source file: `src/core/rag/DocumentIngester.ts`

## Purpose

Controls chunking and embedding generation during ingestion.

## Schema

```ts
export interface IngestOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  embeddingProvider?: 'openai' | 'xenova' | 'ollama';
}
```

## Field Notes

### `chunkSize`

Current default: `500`.

Use smaller chunks for precise facts and larger chunks for narrative docs.

### `chunkOverlap`

Current default: `50`.

Overlap helps preserve context between chunks.

### `generateEmbeddings`

When true, embeddings are generated if `EmbeddingService` is available.

### `embeddingProvider`

Allowed providers:

- `openai`
- `xenova`
- `ollama`

---

# `DatasetOptions`

Source file: `src/core/knowledge/DatasetLoader.ts`

## Purpose

Controls structured dataset loading.

## Schema

```ts
export interface DatasetOptions {
  generateEmbeddings?: boolean;
  chunkSize?: number;
  includeHeaders?: boolean;
  delimiter?: string;
}
```

## Field Notes

### `chunkSize`

For CSV and SQLite, this means rows per chunk.

For JSON, this means items per chunk.

### `includeHeaders`

Used for CSV parsing.

### `delimiter`

Defaults to comma.

---

# Recommended Future Schema: `KnowledgeEntry`

Use this for curated JSON knowledge bases.

```ts
interface KnowledgeEntry {
  id: string;
  title: string;
  source: string;
  section?: string;
  type: 'concept' | 'how-to' | 'contract' | 'decision' | 'troubleshooting' | 'schema' | 'api';
  authority: 'canonical' | 'current' | 'draft' | 'deprecated' | 'external' | 'example';
  tags: string[];
  lastUpdated: string;
  content: string;
  relatedPaths?: string[];
  relatedClasses?: string[];
  relatedMethods?: string[];
}
```

## Example

```json
{
  "id": "rag-service-contract",
  "title": "RAGService Contract",
  "source": "docs/rag/02_module_contracts.md",
  "section": "RAGService",
  "type": "contract",
  "authority": "canonical",
  "tags": ["rag", "service", "orchestration"],
  "lastUpdated": "2026-05-19",
  "content": "RAGService orchestrates query expansion, retrieval, reranking, compression, generation, and citation extraction.",
  "relatedPaths": ["src/core/rag/RAGService.ts"],
  "relatedClasses": ["RAGService"],
  "relatedMethods": ["processQuery", "addDocuments"]
}
```

---

# Schema Change Rules

When modifying schemas:

1. Update `src/types/rag.ts`.
2. Update this document.
3. Update ingestion code that produces affected objects.
4. Update retrieval/reranking/compression code that consumes affected objects.
5. Update tests.
6. Add a decision log entry for breaking changes.