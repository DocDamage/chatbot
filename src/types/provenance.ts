/**
 * Provenance Ledger - Content Ownership & Lineage
 */

export enum ArtifactStatus {
  ACTIVE = 'ACTIVE',
  QUARANTINED = 'QUARANTINED',
  DEPRECATED = 'DEPRECATED'
}

export enum ArtifactType {
  RESPONSE = 'RESPONSE',
  DIALOGUE = 'DIALOGUE',
  QUEST = 'QUEST',
  LORE = 'LORE',
  MEMORY = 'MEMORY'
}

export interface ProvenanceRecord {
  artifact_id: string;
  type: ArtifactType;
  canon_level: string;
  source_model: string;
  source_parameters: Record<string, unknown>;
  prompt_hash: string;
  retrieval_refs?: string[];
  memory_refs?: string[];
  contract_version: string;
  author: 'system' | 'user' | 'mod';
  status: ArtifactStatus;
  rollback_pointer?: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

