# Native Candidate Provenance and File Mapping Register

**Date:** 2026-08-25
**Scope:** File-level provenance tracking for native adaptation candidate sources.

---

## 1. Candidate Source Mappings

| Upstream Source | Source File / Module Concept | Upstream License | Retained Notice Header Requirement | Planned Target Path in ChatBot | Adaptation Type |
|---|---|---|---|---|---|
| **RepoCortex** | Capability pack schema & validation | MIT | `Copyright (c) 2026 RepoCortex contributors` | `src/core/capabilities/packs/` | Translated to TS with schema validation |
| **CodeMunch Pro** | Byte-offset symbol indexer & call graph | MIT | `Copyright (c) 2026 CodeMunch contributors` | `src/core/repository-intelligence/indexes/` | Clean-room / Translated TS algorithms |
| **DevLens Agent** | Churn, complexity, and hotspot scoring | MIT | `Copyright (c) 2026 DevLens contributors` | `src/core/repository-intelligence/risk/` | Native TypeScript calculation engine |
| **Graft** | Architecture cards & crux excerpt extraction | MIT | `Copyright (c) 2026 Graft contributors` | `src/core/repository-intelligence/architecture/` | Native TS architecture card provider |
| **PixelRefiner** | Palette quantization & grid detection | MIT | `Copyright (c) 2026 PixelRefiner contributors` | `src/core/studios/sprite/` | Native TS / worker image algorithms |
| **Forge CLI** | Safe transaction engine & path policy | MIT | `Copyright (c) 2026 Forge CLI contributors` | `src/core/integrations/godot/transactions/` | Native TS transaction journal |
| **Monoleaf** | Markdown WYSIWYG & change tracker | MIT | `Copyright (c) 2026 Monoleaf contributors` | `client/src/features/writing-studio/` | React component adaptation |
| **Lexicon** | Grammar & proofreading suggestion engine | MIT | `Copyright (c) 2026 Lexicon contributors` | `src/core/integrations/proofreading/` | Native TS rule / provider adapter |
| **OpenForge** | Visual block editor & schema compiler | MIT | `Copyright (c) 2026 OpenForge contributors` | `client/src/features/web-studio/` | React block canvas adaptation |
| **Remembrandt** | Markdown memory export & categorization | MIT | `Copyright (c) 2026 Remembrandt contributors` | `src/core/project-memory/export/` | Native TS export / sync module |
| **Headroom** | Reversible token compression algorithms | Apache-2.0 | `Copyright 2026 Headroom contributors` | `src/core/context-economy/compressors/` | Native TS lossless compression |
| **Capsule** | JSON/CSV deterministic mock API engine | MIT | `Copyright (c) 2026 Capsule contributors` | `src/core/integrations/mock-api/` | Native TS mock server engine |
| **Book-to-Skill** | Skill generation & markdown layout | MIT | `Copyright (c) 2026 Book-to-Skill contributors` | `src/core/capabilities/skills/` | Native TS parser & generator |

---

## 2. Invariants for Native Code Adaptations

1. **File Header Requirement**: Every file derived from an upstream native candidate must include a SPDX identifier and attribution header referencing the upstream repository, original authors, and exact license.
2. **Independent Test Provenance**: All adapted modules must include project-owned unit and integration tests under `src/**/__tests__/` written to project conventions.
3. **Strict Type Safety & Linting**: All adapted TypeScript code must pass `npm run type-check:server`, `npm run type-check:tests`, and `npm run lint:server` with 0 warnings.
