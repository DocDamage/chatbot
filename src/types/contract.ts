/**
 * AI Contract System - The Control Plane
 * Every AI action is bound by an explicit contract enforced at the tool level
 */

export enum CanonWritePolicy {
  NONE = 'NONE',
  SUGGEST_ONLY = 'SUGGEST_ONLY',
  CONFIRM_REQUIRED = 'CONFIRM_REQUIRED',
  DIRECT = 'DIRECT'
}

export enum ContentPersistence {
  NO_PERSIST = 'NO_PERSIST',
  EPISODIC_ONLY = 'EPISODIC_ONLY',
  CANON_ALLOWED = 'CANON_ALLOWED'
}

export enum FallbackStrategy {
  CHEAPER_MODEL = 'CHEAPER_MODEL',
  TEMPLATE = 'TEMPLATE',
  ERROR = 'ERROR'
}

export type Capability = 
  | 'DIALOGUE_GENERATE'
  | 'QUEST_PROPOSE'
  | 'QUEST_WRITE_CANON'
  | 'SIMULATE_OUTCOMES'
  | 'MOD_SUBMIT'
  | 'MOD_VALIDATE'
  | 'EXPORT_CONTENT'
  | 'GENERAL_QUERY';

export interface AIContract {
  contract_id: string;
  version: string;
  allowed_capabilities: Capability[];
  allowed_tools?: string[];
  canon_write_policy: CanonWritePolicy;
  required_validators: string[];
  max_cost_per_request: number;
  max_latency_ms: number;
  fallback_strategy: FallbackStrategy;
  content_persistence: ContentPersistence;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_CONTRACT: AIContract = {
  contract_id: 'default-general-chat',
  version: '1.0.0',
  allowed_capabilities: ['GENERAL_QUERY', 'DIALOGUE_GENERATE'],
  canon_write_policy: CanonWritePolicy.NONE,
  required_validators: ['safety', 'tone'],
  max_cost_per_request: 0.10,
  max_latency_ms: 5000,
  fallback_strategy: FallbackStrategy.CHEAPER_MODEL,
  content_persistence: ContentPersistence.EPISODIC_ONLY
};

