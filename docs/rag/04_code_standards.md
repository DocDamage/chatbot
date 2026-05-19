---
title: Code Standards
source: docs/rag/04_code_standards.md
section: code_standards
tags: [typescript, standards, testing, rag, maintainability]
last_updated: 2026-05-19
authority: canonical
---

# Code Standards

## Purpose

This document defines coding standards for the chatbot project, especially the RAG, provider, knowledge, safety, and tooling layers.

These rules are intended for both human developers and coding agents.

## Primary Language

Use TypeScript for application code.

## Core Style Rules

1. Prefer explicit interfaces over loose object shapes.
2. Keep classes focused on one responsibility.
3. Use dependency injection for services like `LLMAdapter` and `EmbeddingService`.
4. Avoid hardcoding provider-specific logic into orchestration classes.
5. Keep source paths, method names, and metadata names stable unless performing a deliberate migration.
6. Preserve existing public contracts unless updating all consumers and tests.
7. Prefer small, testable helpers over long methods.
8. Avoid silent failures.
9. Log meaningful failures through the logger instead of using raw `console.log` in core code.
10. Never commit secrets, API keys, tokens, credentials, or local private data.

## RAG-Specific Rules

### Keep Responsibilities Separate

- `DocumentIngester` reads and chunks documents.
- `DocumentManager` adds files/text/directories to the knowledge base.
- `HybridRetriever` retrieves candidate chunks.
- `QueryExpander` expands the query.
- `ReRanker` reranks results.
- `ContextCompressor` compresses context.
- `CitationTracker` extracts and formats citations.
- `RAGService` orchestrates the pipeline.

Do not collapse these roles into one file.

### Preserve Exact Retrieval

Do not remove keyword/exact matching just because dense vector search exists.

This project needs exact matching for:

- File paths.
- Class names.
- Method names.
- Configuration keys.
- Error messages.
- API names.

### Preserve Semantic Retrieval

Do not remove dense vector retrieval just because exact matching exists.

Semantic retrieval is needed when the user asks in different words than the documentation uses.

### Preserve Metadata

Every `DocumentChunk` should have useful metadata.

Minimum metadata:

```ts
{
  source: string,
  title?: string,
  section?: string,
  type?: string
}
```

Recommended metadata:

```ts
{
  source: string,
  title: string,
  section: string,
  type: 'markdown' | 'text' | 'json' | 'pdf' | 'csv' | 'sqlite',
  tags: string[],
  authority: 'canonical' | 'current' | 'draft' | 'deprecated' | 'external',
  lastUpdated: string
}
```

## Error Handling Rules

Use structured error handling.

Good:

```ts
try {
  const chunks = await ingester.ingestFile(filePath, options);
  return chunks;
} catch (error: any) {
  logger.warn('Failed to ingest file', { filePath, error: error.message });
  throw error;
}
```

Bad:

```ts
try {
  return await ingest(file);
} catch {
  return [];
}
```

Silent fallback is only acceptable when the returned metadata clearly records that a failure happened.

## Logging Rules

Use the project logger in core services.

Log:

- ingestion start/failure/success
- number of chunks generated
- embedding provider failures
- retrieval result counts
- compression ratio
- citation count
- safety warnings

Do not log:

- API keys
- full secrets
- raw private user documents unless debugging is explicitly configured
- sensitive personal data

## Testing Rules

Every RAG behavior change should include tests.

Minimum tests for ingestion changes:

- Markdown file loads.
- Text file loads.
- JSON file loads.
- PDF parse failure is handled safely.
- Metadata is preserved.
- Chunk ids are stable enough for citations.

Minimum tests for retrieval changes:

- Exact class name query returns the right chunk.
- File path query returns the right chunk.
- Natural language query returns semantically relevant chunks.
- Empty knowledge base returns a safe empty result.
- Duplicate chunks are deduplicated.

Minimum tests for compression changes:

- Short context is preserved.
- Long context is compressed or truncated.
- Source markers are not destroyed when citation reliability depends on them.

Minimum tests for citation changes:

- Source title appears in formatted citation.
- Source path is preserved.
- Weakly related chunks are not over-cited.

## Provider Rules

Provider-specific code belongs in provider classes or adapters.

Do not hardcode OpenAI, Ollama, Xenova, Gemini, Anthropic, or any specific provider into generic RAG orchestration.

## Embedding Rules

1. Do not mix embeddings from different dimensions in the same active index unless the retriever supports separate vector spaces.
2. If the embedding model changes, reindex existing documents.
3. Store or derive enough metadata to know which provider/model generated an embedding.
4. Batch embeddings where possible, but preserve per-chunk failure visibility.

## Documentation Rules

When adding or changing behavior:

1. Update the relevant doc in `docs/rag/`.
2. Update `09_decision_log.md` for major architectural choices.
3. Update `08_troubleshooting.md` when a new recurring failure mode is discovered.
4. Update `07_data_schemas.md` when interfaces change.

## Security Rules

Never ingest or commit:

- `.env` files
- API keys
- access tokens
- private keys
- OAuth secrets
- raw production user data
- confidential customer records
- personal medical, legal, or financial records unless the system is explicitly designed and secured for that use

## Performance Rules

Avoid unnecessary full reindexing.

Future improvements should prefer:

- file hashing
- incremental ingestion
- embedding cache
- provider concurrency limits
- persistent vector store
- metadata filters before vector search

## Coding Agent Behavior

When a coding agent works on this repo, it should:

1. Inspect relevant files first.
2. Identify the owning module before editing.
3. Avoid broad rewrites unless requested.
4. Preserve working behavior.
5. Add tests for behavior changes.
6. Update docs when changing architecture.
7. Be explicit about limitations and incomplete work.
8. Prefer one clean path over redundant duplicated systems.

## Definition of Clean RAG Code

Clean RAG code is:

- modular
- typed
- observable
- testable
- metadata-preserving
- provider-agnostic where possible
- honest about parse/retrieval/citation limits
- easy to replace with better retrieval/storage later