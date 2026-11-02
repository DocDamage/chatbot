# Runbook: RAG Retrieval Degraded Triage & Remediation

## 1. Severity & Impact
- **Severity**: P2 (High).
- **Impact**: Increased query latency, ungrounded/hallucinated answers, missing citations, or retrieval timeout errors.

## 2. Detection & Symptoms
- Alert: `RAGLatencyHigh` ($P95 > 1200\text{ms}$ sustained for 5 minutes).
- Alert: `CitationPrecisionDegraded` (Citation precision dropping below 85%).
- Metric: `unnecessary_retrieval_rate > 0.25` or `rag_retrieval_errors_total > 10`.

## 3. Immediate Diagnostic Workflow
1. **Examine Recent Query Waterfalls**:
   Open the diagnostics modal or fetch recent chat runs:
   `GET /api/debug/chat-runs?status=degraded&limit=10`
   Check whether the bottleneck is in the vector store query, BM25 keyword lookup, or cross-encoder reranking.
2. **Check Vector Database Resource Utilization**:
   - Check CPU and memory utilization on the vector backend (SQLite, sqlite-vec, PostgreSQL pgvector).
   - Check if an index rebuild or vacuum lock is active.
3. **Verify Retrieval Scoring Weights**:
   Confirm that recent retrieval weight tuning didn't degrade lexical/semantic balance:
   ```bash
   npm run eval:retrieval
   ```

## 4. Remediation Steps
- **Temporary Score Weight Rollback**:
  Use `CanonicalRollbackCoordinator` to revert to previous retrieval weight policy.
- **Cache Eviction & Index Reconnect**:
  Restart retrieval connection pools or prune degraded memory caches.
- **Fallback to Lexical Only / Fast Mode**:
  If vector search is unavailable, configure the runtime fallback to BM25 lexical search temporarily to maintain service continuity.
