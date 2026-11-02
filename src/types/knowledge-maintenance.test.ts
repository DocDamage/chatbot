/**
 * Knowledge Maintenance Types Unit Tests (CRK-P26)
 */

import {
  RefreshCadence,
  DatasetLifecycleStatus,
  DatasetRefreshPolicy,
  EmbeddingMetadata,
  OperationalAlert,
  ReleaseCutoverChecklist,
} from './knowledge-maintenance';

describe('Knowledge Maintenance Types', () => {
  it('validates refresh cadences and policy structure', () => {
    const policy: DatasetRefreshPolicy = {
      datasetId: 'official-docs-ts',
      cadence: 'daily',
      intervalMs: 86400000,
      autoUpdateEnabled: true,
      dependencies: [],
    };
    expect(policy.cadence).toBe('daily');
    expect(policy.intervalMs).toBe(86400000);
    expect(policy.autoUpdateEnabled).toBe(true);
  });

  it('validates dataset lifecycle status flow', () => {
    const statuses: DatasetLifecycleStatus[] = [
      'DOWNLOADING',
      'NORMALIZING',
      'INDEXING',
      'VERIFYING',
      'READY',
      'FAILED',
      'RETIRED',
    ];
    expect(statuses).toHaveLength(7);
  });

  it('validates embedding metadata schema with dimensionality and normalization', () => {
    const meta: EmbeddingMetadata = {
      provider: 'local-transformer',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      normalization: 'l2',
      createdAt: 1700000000000,
      version: 'v1.0.0',
    };
    expect(meta.dimensions).toBe(1536);
    expect(meta.normalization).toBe('l2');
  });

  it('verifies operational alert structure and codes', () => {
    const alert: OperationalAlert = {
      id: 'alt-001',
      code: 'PACK_STALE_BEYOND_POLICY',
      severity: 'WARNING',
      datasetId: 'dev-qa-so',
      message: 'Pack developer-qa has exceeded refresh TTL',
      timestamp: Date.now(),
    };
    expect(alert.code).toBe('PACK_STALE_BEYOND_POLICY');
    expect(alert.severity).toBe('WARNING');
  });

  it('verifies release cutover checklist defaults', () => {
    const checklist: ReleaseCutoverChecklist = {
      shadowComparisonPassed: true,
      goldenSuitePassed: true,
      defaultPackAbEvidenceRecorded: true,
      databaseMigrationsVerified: true,
      rollbackFlagTested: true,
      stagingGatePassed: true,
      canaryUserBetaPassed: true,
      diagnosticsInspected: true,
      canonicalRuntimeEnabledDefault: true,
      rollbackWindowActive: true,
      legacyDecommissionScheduled: false,
    };
    expect(checklist.shadowComparisonPassed).toBe(true);
    expect(checklist.legacyDecommissionScheduled).toBe(false);
  });
});
