/**
 * Section 44: Rollback Strategy Types & Invariants
 * Governs coordinated multi-domain rollbacks while strictly preserving data integrity.
 */
import { z } from 'zod';

export type RollbackDomain =
  | 'runtime'
  | 'dataset'
  | 'retrieval_policy'
  | 'model_policy'
  | 'all';

export const RollbackDomainSchema = z.enum([
  'runtime',
  'dataset',
  'retrieval_policy',
  'model_policy',
  'all',
]);

export interface PreservationInvariants {
  conversationDataPreserved: boolean;
  ragDataPreserved: boolean;
  datasetMetadataPreserved: boolean;
  botProfilesPreserved: boolean;
  feedbackPreserved: boolean;
  activeKnowledgeVersionPreserved: boolean;
}

export interface RollbackAction {
  domain: RollbackDomain;
  targetVersionOrFlag: string;
  reason: string;
  actor: string;
  timestamp: string;
}

export interface RollbackExecutionResult {
  domain: RollbackDomain;
  success: boolean;
  previousState: Record<string, unknown>;
  restoredState: Record<string, unknown>;
  invariants: PreservationInvariants;
  errors?: string[];
}

export const PreservationInvariantsSchema = z.object({
  conversationDataPreserved: z.boolean(),
  ragDataPreserved: z.boolean(),
  datasetMetadataPreserved: z.boolean(),
  botProfilesPreserved: z.boolean(),
  feedbackPreserved: z.boolean(),
  activeKnowledgeVersionPreserved: z.boolean(),
});
