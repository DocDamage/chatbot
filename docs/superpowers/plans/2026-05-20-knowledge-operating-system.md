# Knowledge Operating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first working vertical slice for graph-aware local knowledge, entity linking, safe database questions, private memory, markdown wiki knowledge, and governance evidence.

**Architecture:** Keep the first pass as TypeScript services that wrap the existing SQLite/PostgreSQL abstraction and RAG document store. Expose small REST routes so the UI/admin cockpit can consume them, while keeping implementation deterministic and local-first.

**Tech Stack:** TypeScript, Express, existing `Database`, existing `RAGDocumentStore`, Jest/Supertest.

---

### Task 1: Core Knowledge Services

**Files:**
- Create: `src/core/entity/EntityLinkingService.ts`
- Create: `src/core/graph/KnowledgeGraphIndexer.ts`
- Create: `src/core/wiki/LocalKnowledgeWiki.ts`
- Create: `src/core/memory/PrivateMemoryStore.ts`
- Create: `src/core/governance/GovernanceEvidenceService.ts`

- [x] Implement deterministic entity extraction for people/software/date-like terms.
- [x] Implement repo/RAG graph indexing with nodes and edges.
- [x] Implement portable markdown wiki read/write/search.
- [x] Implement private memory CRUD with confidence, decay, and approval flags.
- [x] Implement answer evidence reports and golden task scoring.

### Task 2: Safe Database Question Agent

**Files:**
- Create: `src/core/database/SafeDatabaseQuestionAgent.ts`
- Modify: `src/core/database/Database.ts`

- [x] Add local schema migrations for graph, entity, memory, and governance tables.
- [x] Add SQL validation that allows only read-only `SELECT` statements.
- [x] Add deterministic database question handlers for counts/search instead of arbitrary SQL generation.

### Task 3: Routes And Wiring

**Files:**
- Create: `src/server/routes/knowledge-os.ts`
- Modify: `src/core/initialization/ServiceInitializer.ts`
- Modify: `src/server/index.ts`

- [x] Wire services into initialization.
- [x] Mount routes for `/api/knowledge-os/*`.
- [x] Add endpoints for entities, graph, wiki, private memory, DB ask/query, and governance reports.

### Task 4: Verification

**Files:**
- Create: `src/core/entity/EntityLinkingService.test.ts`
- Create: `src/core/database/SafeDatabaseQuestionAgent.test.ts`
- Create: `src/server/routes/__tests__/knowledge-os.test.ts`

- [x] Run focused unit/route tests.
- [x] Run TypeScript type-check.
