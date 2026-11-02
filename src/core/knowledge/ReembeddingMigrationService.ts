/**
 * Re-embedding Migration Service (CRK-P26-T05)
 *
 * Implements non-destructive dual-index embedding migrations:
 * 1. Build new embeddings alongside current active version
 * 2. Validate retrieval quality
 * 3. Atomically switch active embedding version
 * 4. Retire old embeddings after safety retention window
 */

import {
  EmbeddingMetadata,
  ReembeddingMigrationPlan,
} from '../../types/knowledge-maintenance';

export interface RetrievalValidationResult {
  passed: boolean;
  score: number;
  threshold: number;
  sampleQueriesEvaluated: number;
}

export class ReembeddingMigrationService {
  private readonly plans = new Map<string, ReembeddingMigrationPlan>();

  /**
   * Plan a non-destructive dual-index migration (§3805-3815)
   */
  public createMigrationPlan(params: {
    datasetId: string;
    sourceEmbedding: EmbeddingMetadata;
    targetEmbedding: EmbeddingMetadata;
    totalChunks: number;
  }): ReembeddingMigrationPlan {
    const migrationId = `mig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const plan: ReembeddingMigrationPlan = {
      migrationId,
      datasetId: params.datasetId,
      sourceEmbedding: params.sourceEmbedding,
      targetEmbedding: params.targetEmbedding,
      totalChunks: params.totalChunks,
      status: 'EMBEDDING_PARALLEL',
      dualIndexActive: true,
      activeVersion: params.sourceEmbedding.version,
    };

    this.plans.set(migrationId, plan);
    return plan;
  }

  /**
   * Step 2: Validate retrieval performance on target embedding before cutover (§3816)
   */
  public validateRetrieval(
    migrationId: string,
    validation: RetrievalValidationResult
  ): boolean {
    const plan = this.plans.get(migrationId);
    if (!plan) {
      throw new Error(`Migration plan '${migrationId}' not found`);
    }

    if (validation.passed && validation.score >= validation.threshold) {
      plan.status = 'VALIDATING';
      return true;
    }

    // Validation failed: rollback safely to source
    plan.status = 'ROLLED_BACK';
    plan.dualIndexActive = false;
    return false;
  }

  /**
   * Step 3: Switch active pointer to the new embedding version (§3817)
   */
  public commitMigration(migrationId: string): void {
    const plan = this.plans.get(migrationId);
    if (!plan) {
      throw new Error(`Migration plan '${migrationId}' not found`);
    }

    if (plan.status !== 'VALIDATING') {
      throw new Error(`Cannot commit migration from status '${plan.status}'. Must be 'VALIDATING'.`);
    }

    plan.status = 'COMMITTED';
    plan.activeVersion = plan.targetEmbedding.version;
    // Dual index remains active during rollback window, then retired later (§3818)
  }

  /**
   * Safe rollback to original embedding version
   */
  public rollbackMigration(migrationId: string): void {
    const plan = this.plans.get(migrationId);
    if (!plan) {
      throw new Error(`Migration plan '${migrationId}' not found`);
    }

    plan.status = 'ROLLED_BACK';
    plan.activeVersion = plan.sourceEmbedding.version;
    plan.dualIndexActive = false;
  }

  public getPlan(migrationId: string): ReembeddingMigrationPlan | undefined {
    return this.plans.get(migrationId);
  }
}
