/**
 * Knowledge Maintenance & Production Hardening Types (CRK-P26)
 *
 * Defines contracts for refresh scheduling, incremental updates, atomicity,
 * job recovery, re-embedding migration, backup policies, metrics, alerts,
 * and release cutovers.
 */

export type RefreshCadence =
  | 'manual'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'release-driven'
  | 'api-incremental'
  | 'commit-driven';

export type DatasetLifecycleStatus =
  | 'DOWNLOADING'
  | 'NORMALIZING'
  | 'INDEXING'
  | 'VERIFYING'
  | 'READY'
  | 'FAILED'
  | 'RETIRED';

export interface DatasetRefreshPolicy {
  datasetId: string;
  cadence: RefreshCadence;
  intervalMs: number;
  lastRefreshedAt?: number;
  dependencies?: string[];
  autoUpdateEnabled: boolean;
}

export interface IncrementalUpdateResult {
  datasetId: string;
  previousVersion: string;
  newVersion: string;
  totalUpstreamRecords: number;
  changedRecords: number;
  reusedRecords: number;
  embeddedChunks: number;
  reusedChunks: number;
  rollbackMetadataPreserved: boolean;
}

export interface EmbeddingMetadata {
  provider: string;
  model: string;
  dimensions: number;
  normalization: 'l2' | 'none' | 'cosine';
  createdAt: number;
  version: string;
}

export interface ReembeddingMigrationPlan {
  migrationId: string;
  datasetId: string;
  sourceEmbedding: EmbeddingMetadata;
  targetEmbedding: EmbeddingMetadata;
  totalChunks: number;
  status: 'PENDING' | 'EMBEDDING_PARALLEL' | 'VALIDATING' | 'COMMITTED' | 'ROLLED_BACK';
  dualIndexActive: boolean;
  activeVersion: string;
}

export type BackupDataClassification =
  | 'REPRODUCIBLE_CACHE'
  | 'CURATED_LOCAL'
  | 'USER_CUSTOM'
  | 'DERIVED_INDEX';

export interface BackupPolicyEntry {
  datasetId: string;
  classification: BackupDataClassification;
  mustBackup: boolean;
  rtoHours: number;
  lastBackupAt?: number;
}

export interface OperationalMaintenanceMetrics {
  totalJobsExecuted: number;
  successfulJobs: number;
  failedJobs: number;
  totalBytesDownloaded: number;
  totalChunksIndexed: number;
  staleDatasetCount: number;
  duplicateRejectionCount: number;
  diskUsagePercent: number;
  freeDiskGb: number;
  averageRetrievalLatencyMs: number;
}

export interface OperationalAlert {
  id: string;
  code:
    | 'PACK_STALE_BEYOND_POLICY'
    | 'REPEATED_REFRESH_FAILURE'
    | 'DISK_THRESHOLD_EXCEEDED'
    | 'INDEX_CORRUPTION_DETECTED'
    | 'LICENSE_POLICY_FAILURE'
    | 'ABNORMAL_SOURCE_COUNT_DROP';
  severity: 'WARNING' | 'CRITICAL';
  datasetId?: string;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface ReleaseCutoverChecklist {
  shadowComparisonPassed: boolean;
  goldenSuitePassed: boolean;
  defaultPackAbEvidenceRecorded: boolean;
  databaseMigrationsVerified: boolean;
  rollbackFlagTested: boolean;
  stagingGatePassed: boolean;
  canaryUserBetaPassed: boolean;
  diagnosticsInspected: boolean;
  canonicalRuntimeEnabledDefault: boolean;
  rollbackWindowActive: boolean;
  legacyDecommissionScheduled: boolean;
}

export interface CutoverDecision {
  canCutover: boolean;
  completedSteps: number;
  totalSteps: number;
  blockingSteps: string[];
}
