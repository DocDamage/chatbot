/**
 * Prompt Assembler Schemas and Types
 * CRK Phase 11: Prompt and Context Assembler (CRK-P11-T01, T02, T06)
 */

export type PromptTrustLevel =
  | 'SYSTEM_POLICY'
  | 'CONTRACT_POLICY'
  | 'BOT_PROFILE'
  | 'USER_INSTRUCTION'
  | 'CONVERSATION_STATE'
  | 'USER_FILE'
  | 'PROJECT_EVIDENCE'
  | 'RETRIEVED_EVIDENCE'
  | 'TOOL_OUTPUT';

export type TruncationStatus = 'full' | 'truncated' | 'omitted';

export interface PromptSection {
  id: string;
  source: string;
  priority: number;
  trustLevel: PromptTrustLevel;
  tokenEstimate: number;
  truncationStatus: TruncationStatus;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CategoryBudget {
  allocatedTokens: number;
  usedTokens: number;
  percentage: number;
}

export interface TokenBudgetReport {
  maxTokens: number;
  totalUsedTokens: number;
  reservedTokens: number;
  categoryAllocations: Record<string, CategoryBudget>;
  droppedSections: string[];
  truncatedSections: string[];
}

export interface PromptTraceMetadata {
  promptPolicyVersion: string;
  botProfileVersion: string;
  retrievalPolicyVersion: string;
  modelPolicyVersion: string;
}

export interface PromptEnvelope {
  system: PromptSection[];
  conversation: PromptSection[];
  evidence: PromptSection[];
  tools: PromptSection[];
  user: PromptSection[];
  tokenBudget: TokenBudgetReport;
  promptVersion: string;
  traceMetadata: PromptTraceMetadata;
}

export type TaskContextType = 'general' | 'coding' | 'research' | 'debug';

export interface AssembledMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
