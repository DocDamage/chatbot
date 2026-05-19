---
title: Project Brief
source: docs/rag/00_project_brief.md
section: project_overview
tags: [chatbot, rag, knowledge-base, architecture]
last_updated: 2026-05-19
authority: canonical
---

# Project Brief

## Project Name

`DocDamage/chatbot`

## Purpose

This project is a modular AI chatbot foundation with a Retrieval-Augmented Generation system, model/provider routing, safety checks, semantic cache support, knowledge ingestion, and extensible tooling.

The RAG layer exists so the chatbot can answer from project-specific knowledge instead of guessing from general model memory.

## Primary Goals

1. Let the chatbot answer questions using local project documentation, codebase guides, structured datasets, and selected PDFs.
2. Keep RAG knowledge grounded in explicit sources with metadata and citations.
3. Support future coding-assistant behavior through a dedicated coding knowledge base.
4. Allow multiple model and embedding providers, including local-first options.
5. Keep components separated so ingestion, retrieval, reranking, compression, citation tracking, and final generation can evolve independently.

## Primary Users

- Project owner/developer using the chatbot as a local assistant.
- Coding agents that need reliable context about this repo.
- Future users who need a chatbot that can load private/local knowledge.
- Developers extending the RAG, tools, providers, cache, or safety layers.

## Current RAG Capabilities

The current RAG implementation supports:

- File ingestion through `DocumentIngester`.
- Direct text ingestion through `DocumentManager.addText()`.
- Directory ingestion through `DocumentManager.addDirectory()`.
- Supported document formats: `.txt`, `.md`, `.json`, `.pdf`, plus fallback text loading.
- Optional embeddings during ingestion.
- Hybrid retrieval using BM25-like scoring, dense vector search, and sparse keyword matching.
- Query expansion through `QueryExpander`.
- Heuristic reranking through `ReRanker`.
- Context compression through `ContextCompressor`.
- Citation extraction through `CitationTracker`.

## Non-Goals

The current RAG system should not be treated as:

- A fully persistent production vector database.
- A perfect repository-wide semantic index.
- A replacement for source-controlled documentation.
- A replacement for tests.
- A guarantee that PDFs will parse correctly, especially scanned/image-only PDFs.
- A guarantee that conflicting documents will be resolved correctly.

## Canonical Knowledge Principle

The RAG system should be fed canonical documentation first, not random dumps.

Preferred order:

1. Curated Markdown docs in `docs/rag/`.
2. Structured JSON or CSV-derived knowledge when schema matters.
3. Text-based PDFs only when the PDF is authoritative and parseable.
4. Raw notes only after they have been cleaned and marked as draft/non-canonical.

## Definition of Done for RAG Documentation

A RAG documentation entry is considered ready when it:

- Has a clear title.
- Has a stable source path.
- Has focused sections with headings.
- Uses exact file paths and exact class names when discussing code.
- Avoids contradictions with current implementation.
- Marks uncertain/future work clearly.
- Can be chunked into useful pieces without losing meaning.

## Recommended Source Authority Levels

Use these labels in frontmatter or document text:

- `canonical` — final source of truth.
- `current` — accurate for the current implementation but may evolve.
- `draft` — planning material, not binding.
- `deprecated` — old information retained for history only.
- `external` — third-party documentation or reference material.

## High-Level System Statement

The chatbot should retrieve the smallest useful set of relevant knowledge chunks, compress them without destroying meaning, and answer with enough source context that the user can verify where the answer came from.