---
title: API Reference
source: docs/rag/06_api_reference.md
section: api_reference
tags: [api, reference, rag, chatbot, endpoints]
last_updated: 2026-05-19
authority: current
---

# API Reference

## Purpose

This document defines the expected API/reference surface for chatbot and RAG integration.

This is a project-facing reference for humans and coding agents. Verify exact server routes against the current source before implementing or changing endpoints.

## Core Internal APIs

The current RAG system is primarily exposed through TypeScript service classes rather than a confirmed public HTTP API.

Primary internal entry points:

- `RAGService.processQuery()`
- `RAGService.addDocuments()`
- `DocumentManager.addFile()`
- `DocumentManager.addText()`
- `DocumentManager.addDirectory()`
- `DocumentIngester.ingestFile()`
- `DocumentIngester.ingestText()`
- `DocumentIngester.ingestDirectory()`
- `HybridRetriever.retrieve()`
- `DatasetLoader.loadCSV()`
- `DatasetLoader.loadJSON()`
- `DatasetLoader.loadSQLite()`

---

# `RAGService.processQuery()`

Path: `src/core/rag/RAGService.ts`

## Purpose

Process a user query through the full RAG pipeline.

## Signature

```ts
async processQuery(
  query: string,
  generateResponse: boolean = true
): Promise<RAGResult>
```

## Input

```ts
query: string
```

The user question or retrieval query.

```ts
generateResponse: boolean
```

When true, the service generates a final LLM answer.

When false, the service returns compressed context instead of a final answer.

## Output

```ts
RAGResult
```

Includes:

- `response`
- `citations`
- `retrievedChunks`
- `compressedContext`
- `metadata`

## Example

```ts
const result = await ragService.processQuery('What does DocumentIngester do?', true);
```

---

# `RAGService.addDocuments()`

Path: `src/core/rag/RAGService.ts`

## Purpose

Add already-created `DocumentChunk[]` entries to the RAG knowledge base.

## Signature

```ts
addDocuments(chunks: DocumentChunk[]): void
```

## Input

```ts
chunks: DocumentChunk[]
```

## Output

No return value.

## Example

```ts
ragService.addDocuments(chunks);
```

---

# `DocumentManager.addFile()`

Path: `src/core/rag/DocumentManager.ts`

## Purpose

Ingest one file and add the generated chunks to the RAG knowledge base.

## Signature

```ts
async addFile(
  filePath: string,
  options?: {
    generateEmbeddings?: boolean;
    chunkSize?: number;
  }
): Promise<DocumentChunk[]>
```

## Supported File Types

- `.txt`
- `.md`
- `.json`
- `.pdf`
- fallback text reading for other extensions

## Example

```ts
const chunks = await documentManager.addFile('docs/rag/01_architecture_map.md', {
  generateEmbeddings: true,
  chunkSize: 500
});
```

---

# `DocumentManager.addText()`

Path: `src/core/rag/DocumentManager.ts`

## Purpose

Add raw text and metadata directly to RAG.

## Signature

```ts
async addText(
  text: string,
  metadata?: Record<string, any>,
  options?: {
    generateEmbeddings?: boolean;
    chunkSize?: number;
  }
): Promise<DocumentChunk[]>
```

## Example

```ts
const chunks = await documentManager.addText(
  'HybridRetriever combines BM25, dense vector search, and sparse keyword matching.',
  {
    source: 'manual-entry',
    title: 'HybridRetriever Summary',
    section: 'retrieval',
    authority: 'canonical'
  },
  {
    generateEmbeddings: true,
    chunkSize: 500
  }
);
```

---

# `DocumentManager.addDirectory()`

Path: `src/core/rag/DocumentManager.ts`

## Purpose

Ingest multiple files from a directory and add them to the RAG knowledge base.

## Signature

```ts
async addDirectory(
  directoryPath: string,
  options?: {
    generateEmbeddings?: boolean;
    chunkSize?: number;
  }
): Promise<DocumentChunk[]>
```

## Important Limit

Treat current directory ingestion as shallow unless recursive traversal is explicitly added.

## Example

```ts
const chunks = await documentManager.addDirectory('docs/rag', {
  generateEmbeddings: true,
  chunkSize: 500
});
```

---

# `DocumentIngester.ingestFile()`

Path: `src/core/rag/DocumentIngester.ts`

## Purpose

Read one file and convert it into chunks.

## Signature

```ts
async ingestFile(
  filePath: string,
  options?: IngestOptions
): Promise<DocumentChunk[]>
```

## Options

```ts
interface IngestOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  embeddingProvider?: 'openai' | 'xenova' | 'ollama';
}
```

---

# `DocumentIngester.ingestText()`

Path: `src/core/rag/DocumentIngester.ts`

## Purpose

Chunk direct text input with supplied metadata.

## Signature

```ts
async ingestText(
  text: string,
  metadata?: Record<string, any>,
  options?: IngestOptions
): Promise<DocumentChunk[]>
```

---

# `HybridRetriever.retrieve()`

Path: `src/core/rag/HybridRetriever.ts`

## Purpose

Retrieve relevant chunks using BM25-style keyword scoring, dense vector similarity, and sparse keyword matching.

## Signature

```ts
async retrieve(
  query: string,
  topK: number = 10,
  weights: { bm25: number; dense: number; sparse: number } = {
    bm25: 0.4,
    dense: 0.4,
    sparse: 0.2
  }
): Promise<RetrievalResult[]>
```

## Example

```ts
const results = await ragService.getRetriever().retrieve('DocumentIngester markdown pdf json', 10);
```

---

# `DatasetLoader.loadCSV()`

Path: `src/core/knowledge/DatasetLoader.ts`

## Purpose

Load CSV rows into `DocumentChunk[]`.

## Signature

```ts
async loadCSV(
  filePath: string,
  options?: DatasetOptions
): Promise<DocumentChunk[]>
```

## Example

```ts
const chunks = await datasetLoader.loadCSV('data/reference.csv', {
  generateEmbeddings: true,
  includeHeaders: true,
  chunkSize: 10
});
ragService.addDocuments(chunks);
```

---

# `DatasetLoader.loadJSON()`

Path: `src/core/knowledge/DatasetLoader.ts`

## Purpose

Load JSON objects into `DocumentChunk[]`.

## Signature

```ts
async loadJSON(
  filePath: string,
  options?: DatasetOptions
): Promise<DocumentChunk[]>
```

## Example

```ts
const chunks = await datasetLoader.loadJSON('data/knowledge.json', {
  generateEmbeddings: true,
  chunkSize: 5
});
ragService.addDocuments(chunks);
```

---

# `DatasetLoader.loadSQLite()`

Path: `src/core/knowledge/DatasetLoader.ts`

## Purpose

Load rows from a SQLite table into `DocumentChunk[]`.

## Signature

```ts
async loadSQLite(
  dbPath: string,
  tableName: string,
  options?: DatasetOptions
): Promise<DocumentChunk[]>
```

## Example

```ts
const chunks = await datasetLoader.loadSQLite('data/knowledge.sqlite', 'entries', {
  generateEmbeddings: true,
  chunkSize: 10
});
ragService.addDocuments(chunks);
```

---

# Expected Future HTTP API

If an HTTP API is added, prefer endpoints like these.

These are proposed contracts, not guaranteed current routes.

## `POST /api/rag/query`

Purpose:

Ask a RAG-backed question.

Request:

```json
{
  "query": "What does DocumentIngester do?",
  "generateResponse": true
}
```

Response:

```json
{
  "response": "DocumentIngester reads supported files and converts them into DocumentChunk entries.",
  "citations": [],
  "retrievedChunks": [],
  "compressedContext": "...",
  "metadata": {
    "retrievalMethod": "hybrid",
    "compressionRatio": 1,
    "numChunksRetrieved": 5
  }
}
```

## `POST /api/rag/documents/file`

Purpose:

Add a server-side file path to RAG.

Request:

```json
{
  "filePath": "docs/rag/01_architecture_map.md",
  "generateEmbeddings": true,
  "chunkSize": 500
}
```

Response:

```json
{
  "chunksAdded": 12,
  "source": "docs/rag/01_architecture_map.md"
}
```

## `POST /api/rag/documents/text`

Purpose:

Add raw text to RAG.

Request:

```json
{
  "text": "RAGService orchestrates the RAG query pipeline.",
  "metadata": {
    "source": "manual-entry",
    "title": "RAGService Summary",
    "authority": "canonical"
  },
  "generateEmbeddings": true,
  "chunkSize": 500
}
```

Response:

```json
{
  "chunksAdded": 1,
  "source": "manual-entry"
}
```

## `GET /api/rag/stats`

Purpose:

Return current knowledge base status.

Response:

```json
{
  "hasEmbeddings": true,
  "embeddingProvider": "configured",
  "documentCount": 0,
  "chunkCount": 0
}
```

## API Implementation Rules

If these endpoints are implemented:

1. Validate file paths.
2. Prevent arbitrary path traversal.
3. Never expose secrets in responses.
4. Return source metadata with ingestion results.
5. Return useful errors when ingestion fails.
6. Support dry-run ingestion for debugging.
7. Add tests for every endpoint.