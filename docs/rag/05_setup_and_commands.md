---
title: Setup and Commands
source: docs/rag/05_setup_and_commands.md
section: setup_commands
tags: [setup, commands, environment, testing, rag]
last_updated: 2026-05-19
authority: current
---

# Setup and Commands

## Purpose

This document gives humans and coding agents one place to find the expected setup, run, build, test, and RAG environment commands.

Validate commands against `package.json` before relying on them in automation.

## Recommended Node Setup

Use a current LTS Node.js version unless the repository specifies otherwise.

Recommended baseline:

```bash
node --version
npm --version
```

## Install Dependencies

```bash
npm install
```

## Run Development Server

Common command:

```bash
npm run dev
```

If this fails, inspect `package.json` for the actual development script.

## Build

Common command:

```bash
npm run build
```

If this fails, inspect `package.json` for the actual build script.

## Test

Common command:

```bash
npm test
```

Targeted test examples:

```bash
npm test -- --testPathPattern="rag"
npm test -- --testPathPattern="knowledge"
npm test -- --testPathPattern="embedding"
```

If the test runner rejects these flags, inspect the test framework configuration and adapt the command.

## Lint

Common command:

```bash
npm run lint
```

If missing, add linting only after confirming the project wants lint enforcement.

## Type Check

Common command:

```bash
npm run typecheck
```

If missing, use:

```bash
npx tsc --noEmit
```

## RAG Environment Variables

Recommended `.env` values for enabling Phase 1 features:

```env
ENABLE_RAG=true
ENABLE_MODEL_ROUTING=true
ENABLE_SAFETY_PIPELINE=true
ENABLE_SEMANTIC_CACHE=true
```

## Embedding Provider Environment

### Xenova Local Embeddings

Default provider in `EmbeddingService`:

```txt
xenova
```

Default model:

```txt
Xenova/all-MiniLM-L6-v2
```

Usually no API key is required for Xenova local embeddings.

### OpenAI Embeddings

Required when using OpenAI provider:

```env
OPENAI_API_KEY=your_key_here
```

Do not commit this key.

### Ollama Embeddings

Default Ollama URL:

```env
OLLAMA_URL=http://localhost:11434
```

Recommended embedding model:

```txt
nomic-embed-text
```

Verify Ollama is running:

```bash
ollama list
```

## RAG Smoke Test Pattern

Use this pattern when writing a test or temporary script:

```ts
import { RAGService } from './src/core/rag/RAGService';
import { DocumentManager } from './src/core/rag/DocumentManager';
import { EmbeddingService } from './src/core/embeddings/EmbeddingService';

const embeddingService = new EmbeddingService();
const ragService = new RAGService(llmAdapter, embeddingService);
const documentManager = new DocumentManager(ragService, embeddingService);

await documentManager.addFile('docs/rag/00_project_brief.md', {
  generateEmbeddings: true,
  chunkSize: 500
});

const result = await ragService.processQuery('What is this project?', true);
console.log(result.response);
console.log(result.citations);
```

Replace `llmAdapter` with the active project adapter.

## Add One File To RAG

```ts
await documentManager.addFile('docs/rag/01_architecture_map.md', {
  generateEmbeddings: true,
  chunkSize: 500
});
```

## Add The RAG Docs Directory

```ts
await documentManager.addDirectory('docs/rag', {
  generateEmbeddings: true,
  chunkSize: 500
});
```

Current note:

- Confirm whether directory ingestion is recursive before expecting nested folders to load.

## Add Raw Text To RAG

```ts
await documentManager.addText(
  'RAGService orchestrates query expansion, retrieval, reranking, compression, generation, and citations.',
  {
    source: 'manual-entry',
    title: 'RAGService Summary',
    section: 'rag_service',
    authority: 'canonical',
    tags: ['rag', 'service']
  },
  {
    generateEmbeddings: true,
    chunkSize: 500
  }
);
```

## Load Structured JSON Dataset

Use `DatasetLoader.loadJSON()` for structured knowledge arrays.

```ts
const loader = new DatasetLoader(embeddingService);
const chunks = await loader.loadJSON('data/knowledge.json', {
  generateEmbeddings: true,
  chunkSize: 5
});
ragService.addDocuments(chunks);
```

## Load CSV Dataset

Use `DatasetLoader.loadCSV()` for tabular reference data.

```ts
const loader = new DatasetLoader(embeddingService);
const chunks = await loader.loadCSV('data/reference.csv', {
  generateEmbeddings: true,
  includeHeaders: true,
  chunkSize: 10
});
ragService.addDocuments(chunks);
```

## Verify RAG Is Finding Docs

Ask exact questions first:

```txt
What does RAGService do?
Where is DocumentIngester located?
What file contains HybridRetriever?
What formats can DocumentIngester read?
```

Then ask semantic questions:

```txt
How does the chatbot find relevant knowledge?
What should I feed into the knowledge base?
Why are Markdown docs preferred?
```

If exact questions fail, ingestion or indexing is broken.

If exact questions pass but semantic questions fail, embeddings or query expansion may be weak.

## Clean Rebuild Strategy

When embeddings or chunking change:

1. Clear the active in-memory/persistent knowledge store.
2. Re-ingest canonical docs.
3. Regenerate embeddings.
4. Re-run exact retrieval smoke tests.
5. Re-run semantic retrieval smoke tests.
6. Re-run citation checks.

## Git Safety Commands

Before making changes:

```bash
git status
git branch
```

After making changes:

```bash
git diff
npm test
npm run build
```

Commit:

```bash
git add docs/rag
git commit -m "Add RAG knowledge documentation"
```

## Troubleshooting Commands

Search for RAG code:

```bash
grep -R "class RAGService" -n src
grep -R "DocumentChunk" -n src
grep -R "EmbeddingService" -n src
```

Find docs:

```bash
find docs -maxdepth 3 -type f
```

Check TypeScript compile:

```bash
npx tsc --noEmit
```

## Command Verification Rule

Coding agents must not assume a command works just because this document lists a common pattern.

Before using a command in a final verification report, inspect project scripts or run the command.