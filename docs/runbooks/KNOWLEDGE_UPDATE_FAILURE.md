# Runbook: Knowledge Update Failure Triage & Recovery

## 1. Severity & Impact
- **Severity**: P2 (High) if update aborts cleanly; P1 (Critical) if corrupted index causes retrieval degradations or service crashes.
- **Impact**: Knowledge drift, stale answers, or failed ingestion jobs. Because updates use shadow staging and atomic pointer swapping, active runtime queries should experience zero disruption.

## 2. Detection & Alerts
- Alert: `KnowledgeUpdateJobFailed` triggered when an ingestion worker fails with exit code != 0.
- Metric: `knowledge_pack_update_errors_total > 0`.
- Log indicator: `[IncrementalUpdateService] Ingestion failed: <reason>`.

## 3. Immediate Triage Steps
1. **Identify the Failed Job**:
   Query active and failed dataset jobs:
   ```bash
   npm run knowledge:stats
   ```
2. **Inspect Worker Diagnostics**:
   Examine ingestion logs for parser errors, network timeouts, or schema mismatches:
   `GET /api/debug/dataset-jobs/:jobId`
3. **Verify Active Version Unchanged**:
   Confirm that the active dataset version remains in `READY` status and that query routing has not pointed to the aborted `STAGING` index.

## 4. Recovery Procedures
- **Staging Cleanup**:
  If a job aborted leaving dangling temporary tables or embedding artifacts:
  ```bash
  npm run knowledge:verify -- <pack>
  ```
  The `JobRecoveryService` automatically cleans orphan staging partitions.
- **Rollback to Prior Stable Checkpoint**:
  If an updated version was prematurely activated:
  ```bash
  npm run check:chat-runtime
  ```
  Execute dataset rollback to previous stable version via `CanonicalRollbackCoordinator`.
- **Rerun Ingestion with Verbose Diagnostics**:
  ```bash
  npm run knowledge:update -- <pack>
  ```
