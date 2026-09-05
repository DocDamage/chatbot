/**
 * Project Memory Evaluation & Verification Suite (PX-05)
 */

import { ProjectMemoryStore } from '../capture/ProjectMemoryStore';
import { MemoryCaptureService } from '../capture/MemoryCaptureService';
import { MemoryManagementService } from '../capture/MemoryManagementService';
import { GitSymbolMemoryAnchor } from '../freshness/GitSymbolMemoryAnchor';
import { MemoryFreshnessEngine } from '../freshness/MemoryFreshnessEngine';
import { BranchMemoryReconciler } from '../reconciliation/BranchMemoryReconciler';
import { HybridMemoryRetriever } from '../retrieval/HybridMemoryRetriever';
import { MemoryPortableExporter } from '../export/MemoryPortableExporter';
import { ByteOffsetSymbolIndex } from '../../repository-intelligence/indexes/ByteOffsetSymbolIndex';
import * as path from 'path';

describe('Project Memory (PX-05)', () => {
  let store: ProjectMemoryStore;
  let captureService: MemoryCaptureService;
  let mgmtService: MemoryManagementService;
  let symbolIndex: ByteOffsetSymbolIndex;
  let anchor: GitSymbolMemoryAnchor;
  let freshnessEngine: MemoryFreshnessEngine;
  let reconciler: BranchMemoryReconciler;
  let retriever: HybridMemoryRetriever;
  let exporter: MemoryPortableExporter;

  beforeEach(() => {
    store = new ProjectMemoryStore();
    store.clear();
    captureService = new MemoryCaptureService(store);
    mgmtService = new MemoryManagementService(store);
    symbolIndex = new ByteOffsetSymbolIndex(path.resolve(__dirname, '../../../../'));
    anchor = new GitSymbolMemoryAnchor(symbolIndex);
    freshnessEngine = new MemoryFreshnessEngine(store, anchor);
    reconciler = new BranchMemoryReconciler(store);
    retriever = new HybridMemoryRetriever(store);
    exporter = new MemoryPortableExporter(store);
  });

  describe('PX05-T01 & PX05-T02: Memory Capture & Multi-Tenant Scoping', () => {
    it('captures user memories and task handoffs with tenant isolation', () => {
      const mem1 = captureService.captureUserMemory({
        ownerId: 'user-alice',
        projectId: 'project-1',
        branch: 'main',
        kind: 'decision',
        title: 'Use SQLite for local mode and PostgreSQL for hosted',
        content: 'Local single-user runs SQLite; cloud hosted uses multi-tenant Postgres.',
        tags: ['database', 'architecture']
      });

      expect(mem1.id).toBeDefined();
      expect(mem1.kind).toBe('decision');
      expect(mem1.confidence).toBe(1.0);

      // Verify User Bob cannot access Alice's user_only memory
      const userOnlyMem = store.save({
        ...mem1,
        id: 'mem_user_only_alice',
        accessScope: 'user_only'
      });

      const bobQuery = store.get('mem_user_only_alice', { userId: 'user-bob' });
      expect(bobQuery).toBeUndefined();

      const aliceQuery = store.get('mem_user_only_alice', { userId: 'user-alice' });
      expect(aliceQuery).toBeDefined();
    });

    it('ingests task handoff decisions and gotchas into memory store', () => {
      const records = captureService.ingestTaskHandoff({
        ownerId: 'user-alice',
        projectId: 'project-1',
        taskId: 'PX05-T01',
        taskTitle: 'Project Memory Schema',
        branch: 'codex/cf04-cf10-integration',
        commitHash: 'a1b2c3d4e5f6',
        summary: 'Completed memory schema implementation',
        decisions: ['Store memories with SHA-256 provenance'],
        gotchas: ['Never trust stale symbol offsets without digest validation'],
        changedFiles: ['src/core/project-memory/ProjectMemorySchema.ts']
      });

      expect(records.length).toBe(2);
      expect(records.some(r => r.kind === 'decision')).toBe(true);
      expect(records.some(r => r.kind === 'gotcha')).toBe(true);
    });
  });

  describe('PX05-T03 & PX05-T04: Freshness, Staleness, and Supersession', () => {
    it('detects stale memories when anchored file digest changes and marks supersession', () => {
      const mem = store.save({
        id: 'mem_auth_cookie',
        ownerId: 'user-alice',
        projectId: 'project-1',
        branch: 'main',
        originatingCommit: '112233',
        kind: 'decision',
        title: 'Use secure SameSite cookie for auth',
        content: 'Cookie must set SameSite=Strict and HttpOnly.',
        evidence: [{ filePath: 'src/auth/cookie.ts', fileDigest: 'digest_v1' }],
        relatedFiles: ['src/auth/cookie.ts'],
        relatedSymbols: [],
        confidence: 0.9,
        captureMethod: 'explicit_user',
        approvalState: 'approved',
        freshnessState: 'current',
        retentionClass: 'permanent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorId: 'user-alice',
        accessScope: 'project_shared',
        tags: ['auth', 'cookie']
      });

      // Digest changed to v2
      const currentDigests = new Map([['src/auth/cookie.ts', 'digest_v2']]);
      const report = freshnessEngine.evaluateFreshness(currentDigests);

      expect(report.staleCount).toBe(1);
      const updatedMem = store.get(mem.id, { userId: 'user-alice' })!;
      expect(updatedMem.freshnessState).toBe('stale');
      expect(updatedMem.confidence).toBeLessThan(0.9);

      // Create new memory and supersede old
      const newMem = captureService.captureUserMemory({
        ownerId: 'user-alice',
        projectId: 'project-1',
        kind: 'decision',
        title: 'Use OAuth2 Bearer token with refresh token rotation',
        content: 'Replaced SameSite cookie with refresh token rotation.'
      });

      const { oldRecord, newRecord } = mgmtService.supersedeMemory(mem.id, newMem.id, { userId: 'user-alice' });
      expect(oldRecord.freshnessState).toBe('superseded');
      expect(oldRecord.supersededBy).toBe(newMem.id);
      expect(newRecord.supersedes).toContain(oldRecord.id);

      // Quarantined and protected memories
      store.save({
        ...mem,
        id: 'mem_quarantined',
        freshnessState: 'quarantined'
      });
      store.save({
        ...mem,
        id: 'mem_protected',
        isProtected: true,
        freshnessState: 'current'
      });
      // Contradiction duplicate
      store.save({
        ...mem,
        id: 'mem_conflict_1',
        title: 'Conflicting Decision',
        kind: 'decision',
        evidence: [],
        isProtected: true,
        freshnessState: 'current'
      });
      store.save({
        ...mem,
        id: 'mem_conflict_2',
        title: 'Conflicting Decision',
        kind: 'decision',
        evidence: [],
        isProtected: true,
        freshnessState: 'current'
      });

      const pass2 = freshnessEngine.evaluateFreshness(currentDigests);
      expect(pass2.quarantinedCount).toBe(1);
      expect(pass2.supersededCount).toBe(1);
      expect(pass2.detectedContradictions.length).toBeGreaterThan(0);
    });
  });

  describe('PX05-T05 & PX05-T06: Cross-Branch Reconciliation & Hybrid Retrieval', () => {
    it('promotes branch memories upon merge and ranks memories by multi-signal score', () => {
      const branchMem = store.save({
        id: 'mem_feature_x',
        ownerId: 'user-alice',
        projectId: 'project-1',
        branch: 'feature/fast-search',
        originatingCommit: 'feat_commit_1',
        kind: 'convention',
        title: 'Cache search results with 60s TTL',
        content: 'Search queries are cached in Redis with a 60s TTL.',
        evidence: [],
        relatedFiles: [],
        relatedSymbols: [],
        confidence: 0.9,
        captureMethod: 'explicit_user',
        approvalState: 'approved',
        freshnessState: 'current',
        retentionClass: 'permanent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorId: 'user-alice',
        accessScope: 'project_shared',
        tags: ['search', 'cache']
      });

      // Reconcile merge into main
      const promoted = reconciler.reconcileBranchMerge('feature/fast-search', 'main', 'merge_commit_abc', { userId: 'user-alice' });
      expect(promoted.length).toBe(1);
      expect(promoted[0].branch).toBe('main');
      expect(promoted[0].tags).toContain('promoted_from_feature/fast-search');

      // Search memories
      const results = retriever.searchMemories('cache search TTL', { branch: 'main' }, { userId: 'user-alice' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memory.title).toContain('Cache search results');

      // Format as prompt context
      const context = retriever.formatAsContext(results);
      expect(context).toContain('### Project Memory Context');
      expect(context).toContain('Cache search results with 60s TTL');
    });
  });

  describe('PX05-T08 & PX05-T09: Transparent Portable Export & Secret Redaction', () => {
    it('exports MEMORY.md with secret redaction and re-imports idempotently', () => {
      captureService.captureUserMemory({
        ownerId: 'user-alice',
        projectId: 'project-1',
        branch: 'main',
        kind: 'decision',
        title: 'Use external provider with API key',
        content: 'Configured api_key: secret_abc123456789 for external service.',
        tags: ['security', 'provider']
      });

      const bundle = exporter.exportBundle({ projectId: 'project-1' }, { userId: 'user-alice' });
      expect(bundle.markdownDoc).toContain('# Project Memory');
      expect(bundle.markdownDoc).toContain('[REDACTED_SECRET]');
      expect(bundle.markdownDoc).not.toContain('secret_abc123456789');

      // Clear store and re-import
      store.clear();
      expect(store.query({}, { userId: 'user-alice' }).length).toBe(0);

      const importResult = exporter.importBundle(bundle, { userId: 'user-alice' });
      expect(importResult.importedCount).toBe(1);
      expect(store.query({}, { userId: 'user-alice' }).length).toBe(1);
    });
  });
});
