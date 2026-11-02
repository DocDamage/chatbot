# Knowledge Platform Architecture

## 1. Overview
The Knowledge Platform provides versioned, source-grounded datasets and specialized domain packs to empower the Chatbot Hub. The platform replaces uncurated web scraping with governed, auditable knowledge packs adhering to strict open licensing and attribution policies.

## 2. Platform Topology
The knowledge system consists of four primary functional layers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Knowledge Pack Manager                          │
│  [Official Docs] [Dev Q&A] [Source Code] [Encyclopedia] [Research/Math]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Dataset Ingestion Engine                        │
│  ├── Source Policy & License Compliance (DatasetLicensePolicy)        │
│  ├── Semantic Hierarchy Chunkers (Symbol & Structure preservation)     │
│  ├── Content Deduplication & Hash Verification (SHA-256)               │
│  └── Dual-Index Staging & Re-embedding Migrations                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Retrieval & Scoring Engine                      │
│  ├── 5-Factor Retrieval Scoring (BM25, Vector, Authority, Recency, Cov)│
│  ├── Multi-Pack Knowledge Router                                      │
│  └── Citation Association & Grounding Verification                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Storage & Persistence Layer                     │
│  ├── Relational Metadata (SQLite / PostgreSQL)                         │
│  ├── Vector Store (HNSW / sqlite-vec / pgvector)                       │
│  └── Atomic Version Activation & Snapshot Backups                      │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Canonical Knowledge Packs
The platform ships with 8 canonical knowledge packs:
1. `official_docs`: High-authority API documentation and language specs (Authority: 0.95).
2. `developer_qa`: Curated StackOverflow/Discourse solutions with accepted answer filtering (Authority: 0.80).
3. `source_code`: AST-indexed canonical libraries and framework repositories (Authority: 0.85).
4. `general_knowledge`: Filtered encyclopedia and factual corpora (Authority: 0.75).
5. `research_literature`: Academic papers and preprint repositories with retraction checks (Authority: 0.88).
6. `math_theorems`: LaTeX formulas and theorem/proof linked structures (Authority: 0.90).
7. `educational_web`: Filtered FineWeb-Edu high-scoring learning materials (Authority: 0.70).
8. `multilingual_corpus`: Language-specific verified multilingual representations.

## 4. Atomic Lifecycle & Maintenance
Datasets progress through a 7-state lifecycle (`PENDING` -> `STAGING` -> `INDEXING` -> `EVALUATING` -> `READY` -> `DEPRECATED` -> `REMOVED`). Queries route only to `READY` versions, guaranteeing zero downtime and safe instant rollbacks.
