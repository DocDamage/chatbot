/**
 * Memory vs Knowledge Decision Table Schemas and Types (Section 52)
 *
 * Enforces strict, non-negotiable boundaries between volatile session state,
 * user persistent memory, repository evidence, canonical knowledge packs,
 * conversation history, project design decisions, developer Q&A datasets,
 * tool run ledgers, and feedback storage.
 */

export type InformationStorageClass =
  | 'conversation_variable'
  | 'user_memory'
  | 'project_evidence'
  | 'knowledge_pack'
  | 'conversation_history'
  | 'project_memory'
  | 'developer_qa'
  | 'tool_ledger'
  | 'feedback_store';

export interface StorageClassRule {
  storageClass: InformationStorageClass;
  description: string;
  isCanonicalKnowledge: boolean;
  persistsAcrossSessions: boolean;
  requiresUserConsent: boolean;
  allowedSourceTypes: string[];
}

export interface InformationPayload {
  id: string;
  content: string;
  sourceType: string;
  targetStorageClass: InformationStorageClass;
  metadata?: Record<string, unknown>;
}

export interface ArbitrationDecision {
  payloadId: string;
  requestedStorageClass: InformationStorageClass;
  approvedStorageClass: InformationStorageClass;
  isAuthorized: boolean;
  rejectionReason?: string;
  timestamp: string;
}

export interface DecisionTableEntry {
  example: string;
  storageClass: InformationStorageClass;
  governingRule: string;
}
