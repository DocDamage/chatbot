# Dataset Refresh Policy Implementation

## 1. Overview
The Dataset Refresh Policy specifies cadence intervals, incremental ingestion mechanics, atomic activation, and recovery procedures for maintaining fresh, accurate knowledge without operational disruption.

## 2. Refresh Schedules by Pack Type
- **Official Documentation (`official_docs`)**: Bi-weekly automated scan for major/minor framework updates and deprecations.
- **Developer Q&A (`developer_qa`)**: Monthly refresh incorporating newly accepted and highly upvoted technical solutions.
- **Source Code (`source_code`)**: Monthly resync against release tags of canonical open-source repositories.
- **Research Literature (`research_literature`)**: Monthly ingest of recent preprint additions and immediate sync of paper retraction lists.
- **General Knowledge / Educational**: Quarterly scheduled refreshes.

## 3. Incremental Update Pipeline
To conserve compute resources and embedding costs, the `IncrementalUpdateService` executes an 11-step pipeline:
1. Fetch latest upstream manifests/files.
2. Compute cryptographic hashes (SHA-256) for all incoming documents.
3. Compare against existing document hash index.
4. Mark deleted documents for tombstoning.
5. Re-chunk only modified or new documents.
6. Re-embed only new chunks.
7. Stage updated index in a shadow schema / collection.
8. Run automated retrieval sanity evaluation against staging index.
9. Promote staged index via atomic pointer swap.
10. Retain prior version for instant rollback window (7 days).
11. Purge tombstoned chunks upon expiration of retention window.

## 4. Re-embedding & Embedding Model Migrations
When upgrading the embedding model (e.g., transitioning to a new dimensional representation):
- The `ReembeddingMigrationService` builds a complete dual-index in the background.
- Canary queries probe both indices concurrently to verify parity.
- Atomic cutover occurs only after the new index passes full retrieval regression benchmarks.
