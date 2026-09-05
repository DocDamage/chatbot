# Knowledge Packs Guide

## 1. Introduction
Knowledge Packs are self-contained, domain-specific bundles of curated documents, chunking strategies, embeddings, and retrieval policies designed to extend the chatbot's expertise.

## 2. Pack Discovery and Listing
To inspect available and installed knowledge packs in your environment, use the CLI or REST API:

```bash
# List all knowledge packs via CLI
npm run knowledge:list

# Inspect pack storage statistics and status
npm run knowledge:stats
```

Or query the REST endpoint:
`GET /api/knowledge/packs`

## 3. Installing a Knowledge Pack
Installing a pack stages its data, verifies SHA-256 integrity, processes chunks, computes embeddings, and evaluates baseline retrieval before activation:

```bash
# Install the official documentation pack
npm run knowledge:install -- official_docs
```

## 4. Updating Knowledge Packs
Packs can be incrementally updated to avoid re-embedding unaltered documents:

```bash
# Update knowledge pack incrementally
npm run knowledge:update -- developer_qa
```

The update pipeline:
1. Compares source document checksums against the existing chunk index.
2. Reuses unchanged vector embeddings.
3. Chunks and embeds only modified and new documents.
4. Atomically activates the new version upon passing validation.

## 5. Verification and Integrity Checks
Ensure manifest and licensing compliance across all packs:

```bash
npm run knowledge:verify -- official_docs
npm run knowledge:verify-manifests
npm run check:knowledge-licenses
```
