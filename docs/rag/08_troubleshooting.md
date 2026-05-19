---
title: Troubleshooting
source: docs/rag/08_troubleshooting.md
section: troubleshooting
tags: [troubleshooting, rag, ingestion, retrieval, embeddings, citations]
last_updated: 2026-05-19
authority: canonical
---

# Troubleshooting

## Purpose

This document lists common RAG failure modes, symptoms, likely causes, and fixes.

Use this first when RAG gives weak answers, no answers, bad citations, or irrelevant chunks.

---

# RAG Returns No Documents

## Symptoms

- Query returns an empty result.
- `retrievedChunks` is empty.
- Final answer says there is not enough context.
- Exact questions like `What is RAGService?` fail.

## Likely Causes

1. No documents were added before querying.
2. `DocumentManager.addFile()` or `addDirectory()` did not run.
3. Directory ingestion pointed at the wrong folder.
4. Ingested files were empty.
5. PDF parsing failed.
6. Query terms do not appear in the docs.
7. The knowledge base is in memory and was lost after restart.

## Fixes

- Add documents before querying.
- Confirm the path exists.
- Start with one known Markdown file.
- Query exact class names and paths.
- Log chunk counts after ingestion.

## Debug Query

```txt
What does RAGService do?
```

## Debug Code Pattern

```ts
const chunks = await documentManager.addFile('docs/rag/01_architecture_map.md', {
  generateEmbeddings: true,
  chunkSize: 500
});
console.log('chunks', chunks.length);

const result = await ragService.processQuery('What does RAGService do?', false);
console.log(result.compressedContext);
```

---

# RAG Finds Irrelevant Documents

## Symptoms

- Retrieved chunks mention unrelated modules.
- Final answer mixes different systems.
- Query about `DocumentIngester` returns unrelated docs.

## Likely Causes

1. Docs are too broad.
2. Chunks contain multiple unrelated topics.
3. Important terms are buried late in long chunks.
4. Metadata titles/sections are missing.
5. Query expansion generated broad queries.
6. Retrieval weights need tuning.

## Fixes

- Split broad docs into smaller focused docs.
- Put exact class names and paths near section starts.
- Add headings for every module.
- Add metadata `title` and `section`.
- Reduce chunk size.
- Ensure the original query is preserved during query expansion.

---

# Exact File Path Queries Fail

## Symptoms

- Querying `src/core/rag/RAGService.ts` does not find the architecture doc.
- Querying a method name returns nothing.

## Likely Causes

1. Docs do not include exact paths.
2. Paths were written inconsistently.
3. Chunking split the path away from the explanation.
4. BM25/sparse retrieval is not indexing the expected content.

## Fixes

- Add exact paths to headings and first paragraphs.
- Use backticks around paths.
- Keep path, class name, and purpose in the same section.
- Re-ingest after updating docs.

---

# Semantic Questions Fail But Exact Questions Work

## Symptoms

- `What does RAGService do?` works.
- `How does the bot use knowledge to answer?` fails.

## Likely Causes

1. Dense embeddings were not generated.
2. Embedding service failed.
3. Embedding provider/model mismatch.
4. Docs only contain terse bullet lists without natural explanations.
5. Query expansion is weak.

## Fixes

- Use `generateEmbeddings: true`.
- Check embedding provider logs.
- Use natural language explanations in docs.
- Verify `EmbeddingService` initialized.
- Use local Xenova embeddings first for a free baseline.

---

# Embedding Generation Fails

## Symptoms

- Logs mention embedding errors.
- Dense retrieval returns no results.
- RAG only works with exact terms.

## Likely Causes

1. Xenova pipeline failed to initialize.
2. OpenAI API key missing when provider is `openai`.
3. Ollama is not running when provider is `ollama`.
4. The selected model is not installed or unavailable.
5. Text is too large or malformed.

## Fixes

### Xenova

- Confirm dependencies are installed.
- Use default model first: `Xenova/all-MiniLM-L6-v2`.

### OpenAI

- Set `OPENAI_API_KEY` in environment.
- Do not commit `.env`.

### Ollama

- Start Ollama.
- Verify model availability:

```bash
ollama list
```

- Prefer `nomic-embed-text` for embeddings when available.

---

# PDF Ingestion Produces Empty Or Bad Chunks

## Symptoms

- Chunks exist but content is blank or garbled.
- RAG cannot answer from a PDF.
- PDF metadata contains parse failure notes.

## Likely Causes

1. PDF is scanned/image-only.
2. PDF has complex layout.
3. PDF text extraction failed.
4. PDF contains tables that parse poorly.

## Fixes

- Convert the PDF to Markdown manually or with a reliable extraction tool.
- Use OCR before ingestion if the PDF is scanned.
- Split long PDFs into topic-specific Markdown docs.
- Preserve page references in metadata when possible.

## Rule

Do not rely on raw PDF ingestion for critical source-of-truth docs if Markdown can be created instead.

---

# Directory Ingestion Misses Files

## Symptoms

- Only some files are ingested.
- Nested folders are ignored.
- `docs/rag/` works but subfolders do not.

## Likely Causes

1. Current directory ingestion reads immediate files only.
2. Files are in nested directories.
3. File extension is unsupported or failed fallback reading.

## Fixes

- Put canonical RAG docs directly under `docs/rag/`.
- Add recursive ingestion intentionally if needed.
- Add ignore patterns before recursive ingestion to avoid `node_modules` and build folders.

---

# Citations Are Missing

## Symptoms

- Response is generated but `citations` is empty.
- Sources are not shown.

## Likely Causes

1. Generated answer does not share enough words with retrieved chunks.
2. Compression rewrote the content too heavily.
3. Metadata source/title is missing.
4. Citation relevance threshold is not met.

## Fixes

- Preserve source markers in compressed context.
- Include titles and paths in chunk content.
- Improve `CitationTracker` to use retrieved chunk ids directly.
- Add source-aware answer prompts.

---

# Citations Are Wrong Or Weak

## Symptoms

- Citation source is unrelated.
- Snippet does not support the answer.
- Multiple sources are cited for one unsupported claim.

## Likely Causes

1. Citation matching is approximate.
2. Duplicated text appears in many docs.
3. Source docs conflict.
4. Compression removed distinctions between sources.

## Fixes

- Avoid duplicate boilerplate across docs.
- Add source-specific wording and metadata.
- Mark authority levels.
- Improve citation logic to cite retrieved chunks used in final context.
- Add span/line tracking in future upgrades.

---

# RAG Answers From Stale Information

## Symptoms

- Answer follows old plan instead of current code.
- Draft docs override canonical docs.
- Deprecated decisions appear as current.

## Likely Causes

1. Old docs are still ingested.
2. Authority metadata is missing.
3. No conflict detection exists.
4. The vector index was not rebuilt after docs changed.

## Fixes

- Mark old docs as `deprecated`.
- Move drafts out of the canonical ingestion path.
- Re-ingest after doc changes.
- Add authority-aware reranking.
- Add a conflict checker.

---

# RAG Hallucinates Despite Retrieved Context

## Symptoms

- Answer includes claims not present in sources.
- Answer invents endpoints, files, or features.
- Answer overstates implementation status.

## Likely Causes

1. Prompt allows model to infer too much.
2. Context is too thin or ambiguous.
3. Retrieved docs are planning docs, not implementation docs.
4. The LLM was asked to generate beyond source context.

## Fixes

- Strengthen system prompt: answer only from context.
- Ask for citations in answer generation.
- Use canonical docs first.
- Mark planned/future features clearly.
- Return “not enough information” when context is missing.

---

# In-Memory Knowledge Is Lost After Restart

## Symptoms

- RAG works during one run, then forgets all documents after restart.
- Documents must be re-added manually.

## Likely Causes

Current RAG core appears to rely on in-memory document storage unless a persistent store is added elsewhere.

## Fixes

- Re-ingest docs on startup.
- Add persistent vector/document storage.
- Add file hash tracking.
- Add startup indexing from `docs/rag/`.

Recommended future stores:

- SQLite for local simple persistence.
- Chroma or LanceDB for local vector storage.
- PostgreSQL plus pgvector for production-style storage.

---

# TypeScript Type Errors Around Retrieval Methods

## Symptoms

- Type errors involving `retrievalMethod`.
- Combined methods like `bm25+dense` conflict with strict union types.

## Likely Causes

`RetrievalResult.retrievalMethod` is typed as fixed values, but merged retrieval can produce combined labels.

## Fixes

- Update type to allow combined string values.
- Or normalize combined retrieval methods to `hybrid`.
- Add tests around merged results.

---

# Quick Health Checklist

Run through this order:

1. Can the app import RAG classes?
2. Can one Markdown file be ingested?
3. Did ingestion produce chunks?
4. Did chunks include metadata.source?
5. Were embeddings generated?
6. Does exact retrieval work?
7. Does semantic retrieval work?
8. Does reranking return focused chunks?
9. Does compression preserve facts?
10. Does final answer cite useful sources?

## Best First Test Document

Use:

```txt
docs/rag/01_architecture_map.md
```

Best first exact query:

```txt
What file contains RAGService?
```

Best first semantic query:

```txt
How does the chatbot retrieve knowledge before answering?
```