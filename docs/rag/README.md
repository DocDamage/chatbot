---
title: RAG Documentation Index
source: docs/rag/README.md
section: index
tags: [rag, documentation, index, knowledge-base]
last_updated: 2026-05-19
authority: canonical
---

# RAG Documentation Index

## Purpose

This folder contains canonical documentation intended to be ingested into the chatbot RAG knowledge base.

These files are designed to be readable by humans and retrievable by the current RAG implementation.

## Recommended Ingestion Path

Ingest this folder first when bootstrapping project knowledge:

```txt
docs/rag/
```

Use `DocumentManager.addDirectory()` or ingest individual files in the order below.

## File Order

1. `00_project_brief.md` — project identity, goals, non-goals, and RAG purpose.
2. `01_architecture_map.md` — core RAG architecture, data flow, known limits, and upgrade targets.
3. `02_module_contracts.md` — responsibilities, inputs, outputs, safe changes, and risky changes per module.
4. `03_rag_knowledge_guide.md` — what documentation to feed RAG and how to structure it.
5. `04_code_standards.md` — TypeScript, RAG, testing, logging, security, and coding-agent rules.
6. `05_setup_and_commands.md` — setup commands, environment variables, RAG smoke tests, and verification commands.
7. `06_api_reference.md` — internal RAG APIs and proposed future HTTP contracts.
8. `07_data_schemas.md` — canonical schemas for RAG types and recommended future knowledge entries.
9. `08_troubleshooting.md` — failure modes, symptoms, likely causes, and fixes.
10. `09_decision_log.md` — architecture and documentation decisions.
11. `10_glossary.md` — definitions of RAG terms used in this project.
12. `11_multimodal_office_ingestion.md` — DOCX/DOC/image/GIF ingestion, OCR options, and operational limits.

## Recommended Ingestion Options

```ts
await documentManager.addDirectory('docs/rag', {
  generateEmbeddings: true,
  chunkSize: 500
});
```

If ingestion is not recursive or if order matters, ingest each file explicitly.

```ts
const files = [
  'docs/rag/README.md',
  'docs/rag/00_project_brief.md',
  'docs/rag/01_architecture_map.md',
  'docs/rag/02_module_contracts.md',
  'docs/rag/03_rag_knowledge_guide.md',
  'docs/rag/04_code_standards.md',
  'docs/rag/05_setup_and_commands.md',
  'docs/rag/06_api_reference.md',
  'docs/rag/07_data_schemas.md',
  'docs/rag/08_troubleshooting.md',
  'docs/rag/09_decision_log.md',
  'docs/rag/10_glossary.md',
  'docs/rag/11_multimodal_office_ingestion.md'
];

for (const file of files) {
  await documentManager.addFile(file, {
    generateEmbeddings: true,
    chunkSize: 500
  });
}
```

## Verification Questions

After ingestion, these exact-match questions should work:

```txt
What file contains RAGService?
What does DocumentIngester do?
What formats can the ingester read?
What does HybridRetriever combine?
What metadata should DocumentChunk include?
What file handles image OCR ingestion?
What file handles DOCX and DOC ingestion?
```

These semantic questions should also work:

```txt
What kind of docs should I feed the knowledge base?
How does the chatbot retrieve project knowledge?
Why are Markdown docs preferred for RAG?
How should I troubleshoot bad citations?
What are the current limitations of this RAG system?
How does the chatbot ingest images and Office documents?
```

## Maintenance Rules

When RAG code changes:

1. Update the affected doc in this folder.
2. Update `07_data_schemas.md` for schema changes.
3. Update `08_troubleshooting.md` for new known failure modes.
4. Update `09_decision_log.md` for architectural decisions.
5. Re-ingest this folder after documentation changes.

## Current Reality Check

These docs describe the current RAG implementation honestly:

- The retriever is hybrid but in-memory unless persistence is added elsewhere.
- PDF ingestion exists but should not be trusted for critical knowledge without validation.
- The reranker is heuristic, not a true transformer cross-encoder.
- Citation extraction is approximate.
- Markdown is still the preferred canonical source format.
- DOCX/DOC/image/GIF support converts files into extracted text/OCR/metadata chunks; it is not true multimodal vector search yet.

## Rule For Future Agents

Do not ingest random project files before ingesting this folder.

Start with canonical docs, then add external or draft sources only when they are clearly labeled.