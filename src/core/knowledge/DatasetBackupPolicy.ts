/**
 * Dataset Backup & Retention Policy (CRK-P26-T06)
 *
 * Classifies datasets and artifacts into:
 * - REPRODUCIBLE_CACHE (web scrapes, Wikipedia dumps, upstream mirrors)
 * - CURATED_LOCAL (local project markdown docs, verified team guides)
 * - USER_CUSTOM (user uploaded files, custom conversation state)
 * - DERIVED_INDEX (embeddings, vector indexes, BM25 inverse indexes)
 *
 * Enforces mandatory backup for irreplaceable data while managing reproducible
 * data through Recovery Time Objective (RTO) regeneration plans.
 */

import {
  BackupDataClassification,
  BackupPolicyEntry,
} from '../../types/knowledge-maintenance';

export class DatasetBackupPolicy {
  private readonly policies = new Map<string, BackupPolicyEntry>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Curated local knowledge: mandatory backup, 4-hour RTO
    this.setPolicy({
      datasetId: 'curated-local-docs',
      classification: 'CURATED_LOCAL',
      mustBackup: true,
      rtoHours: 4,
    });

    // User-created packs & variables: mandatory backup, 1-hour RTO
    this.setPolicy({
      datasetId: 'user-custom-packs',
      classification: 'USER_CUSTOM',
      mustBackup: true,
      rtoHours: 1,
    });

    // Upstream technical documentation: reproducible cache, 24-hour RTO
    this.setPolicy({
      datasetId: 'official-docs-ts',
      classification: 'REPRODUCIBLE_CACHE',
      mustBackup: false,
      rtoHours: 24,
    });

    // Derived vector index: reproducible from source, 12-hour RTO
    this.setPolicy({
      datasetId: 'vector-indexes-all',
      classification: 'DERIVED_INDEX',
      mustBackup: false,
      rtoHours: 12,
    });
  }

  public setPolicy(entry: BackupPolicyEntry): void {
    this.policies.set(entry.datasetId, { ...entry });
  }

  public getPolicy(datasetId: string): BackupPolicyEntry | undefined {
    return this.policies.get(datasetId);
  }

  /**
   * Filters datasets that require mandatory backup exports (§3831)
   */
  public getMandatoryBackupDatasets(): BackupPolicyEntry[] {
    return Array.from(this.policies.values()).filter((p) => p.mustBackup);
  }

  /**
   * Classify dataset retention category (§3824-3830)
   */
  public classify(classification: BackupDataClassification): {
    requiresColdStorage: boolean;
    canRegenerateFromSource: boolean;
  } {
    switch (classification) {
      case 'USER_CUSTOM':
      case 'CURATED_LOCAL':
        return { requiresColdStorage: true, canRegenerateFromSource: false };
      case 'REPRODUCIBLE_CACHE':
      case 'DERIVED_INDEX':
      default:
        return { requiresColdStorage: false, canRegenerateFromSource: true };
    }
  }
}
