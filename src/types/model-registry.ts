import { z } from 'zod';

export type ModelPrivacyMode = 'remote' | 'local';

export type ModelStatus = 'available' | 'unavailable' | 'unknown' | 'rate-limited';

export type ProviderHealthState =
  | 'not-configured'
  | 'auth-failure'
  | 'rate-limited'
  | 'timeout'
  | 'unavailable'
  | 'unsupported-model'
  | 'healthy';

export enum UserFacingModelPolicy {
  AUTO = 'AUTO',
  FAST = 'FAST',
  BALANCED = 'BALANCED',
  REASONING = 'REASONING',
  CODING = 'CODING',
  CREATIVE = 'CREATIVE',
  LOCAL = 'LOCAL'
}

export interface ModelCapabilities {
  chat: boolean;
  streaming: boolean;
  tools: boolean;
  structuredOutput: boolean;
  vision: boolean;
  embeddings: boolean;
  reasoningClass?: 'basic' | 'balanced' | 'advanced';
  codingClass?: 'basic' | 'balanced' | 'advanced';
}

export interface ModelCostMetadata {
  inputPerMillion?: number;
  outputPerMillion?: number;
  source: 'config' | 'provider' | 'unknown';
  verifiedAt?: string;
}

export interface RegisteredModel {
  provider: string;
  model: string;
  enabled: boolean;
  verifiedAt?: string;
  capabilities: ModelCapabilities;
  contextWindow?: number;
  maxOutputTokens?: number;
  cost?: ModelCostMetadata;
  privacy: ModelPrivacyMode;
  status: ModelStatus;
}

export interface ModelRoutingRequirements {
  policy: UserFacingModelPolicy;
  explicitModel?: { provider: string; model: string };
  requiresTools?: boolean;
  requiresStructuredOutput?: boolean;
  requiresVision?: boolean;
  requiresStreaming?: boolean;
  estimatedTokens?: number;
  preferPrivacy?: ModelPrivacyMode;
  costCeilingPerMillion?: number;
  taskType?: string;
}

export interface FallbackStep {
  from: { provider: string; model: string };
  to: { provider: string; model: string };
  reason: string;
  preservedCapabilities: string[];
}

export interface ModelRoutingDecision {
  selected: RegisteredModel;
  policy: UserFacingModelPolicy;
  fallbackChain: RegisteredModel[];
  fallbackHistory?: FallbackStep[];
  rationale: string;
  matchScore: number;
}

export const RegisteredModelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  enabled: z.boolean(),
  verifiedAt: z.string().optional(),
  capabilities: z.object({
    chat: z.boolean(),
    streaming: z.boolean(),
    tools: z.boolean(),
    structuredOutput: z.boolean(),
    vision: z.boolean(),
    embeddings: z.boolean(),
    reasoningClass: z.enum(['basic', 'balanced', 'advanced']).optional(),
    codingClass: z.enum(['basic', 'balanced', 'advanced']).optional()
  }),
  contextWindow: z.number().positive().optional(),
  maxOutputTokens: z.number().positive().optional(),
  cost: z.object({
    inputPerMillion: z.number().nonnegative().optional(),
    outputPerMillion: z.number().nonnegative().optional(),
    source: z.enum(['config', 'provider', 'unknown']),
    verifiedAt: z.string().optional()
  }).optional(),
  privacy: z.enum(['remote', 'local']),
  status: z.enum(['available', 'unavailable', 'unknown', 'rate-limited'])
});
