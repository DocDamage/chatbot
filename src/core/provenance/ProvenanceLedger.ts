/**
 * Provenance Ledger - Tracks content lineage and ownership
 */

import { ProvenanceRecord, ArtifactType, ArtifactStatus } from '../../types/provenance';
import { AIContract } from '../../types/contract';
import { logger } from '../observability/logger';
import { createHash } from 'crypto';

export class ProvenanceLedger {
  private records: Map<string, ProvenanceRecord> = new Map();

  /**
   * Create a provenance record for an artifact
   */
  createRecord(
    artifactId: string,
    type: ArtifactType,
    content: string,
    contract: AIContract,
    sourceModel: string,
    sourceParameters: Record<string, unknown>,
    author: 'system' | 'user' | 'mod' = 'system',
    memoryRefs?: string[],
    retrievalRefs?: string[]
  ): ProvenanceRecord {
    const promptHash = this.hashContent(content);
    
    const record: ProvenanceRecord = {
      artifact_id: artifactId,
      type,
      canon_level: 'NONCANON', // Default, can be upgraded
      source_model: sourceModel,
      source_parameters: sourceParameters,
      prompt_hash: promptHash,
      retrieval_refs: retrievalRefs,
      memory_refs: memoryRefs,
      contract_version: contract.version,
      author,
      status: ArtifactStatus.ACTIVE,
      created_at: new Date()
    };

    this.records.set(artifactId, record);
    logger.info(`Created provenance record`, { artifact_id: artifactId, type, contract_version: contract.version });

    return record;
  }

  /**
   * Get provenance record
   */
  getRecord(artifactId: string): ProvenanceRecord | undefined {
    return this.records.get(artifactId);
  }

  /**
   * Quarantine an artifact
   */
  quarantine(artifactId: string, reason?: string): void {
    const record = this.records.get(artifactId);
    if (record) {
      record.status = ArtifactStatus.QUARANTINED;
      if (reason) {
        record.metadata = { ...record.metadata, quarantine_reason: reason };
      }
      logger.warn(`Quarantined artifact`, { artifact_id: artifactId, reason });
    }
  }

  /**
   * Update canon level
   */
  updateCanonLevel(artifactId: string, canonLevel: string): void {
    const record = this.records.get(artifactId);
    if (record) {
      record.canon_level = canonLevel;
      logger.info(`Updated canon level`, { artifact_id: artifactId, canon_level: canonLevel });
    }
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}

