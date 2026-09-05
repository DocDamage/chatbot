/**
 * Section 48: Required CI Gates Specification & Types
 */
import { z } from 'zod';

export const CIGateScopeSchema = z.enum(['pr', 'release_only']);
export type CIGateScope = z.infer<typeof CIGateScopeSchema>;

export const PRCIGateNameSchema = z.enum([
  'chat-runtime-unit',
  'chat-runtime-integration',
  'conversation-state',
  'context-planner',
  'knowledge-manifest',
  'knowledge-db-migrations',
  'knowledge-adapter-fixtures',
  'retrieval-evals',
  'tool-truth-evals',
  'golden-chat-smoke',
  'client-knowledge-ui',
  'client-feedback-ui',
  'diagnostics-redaction'
]);
export type PRCIGateName = z.infer<typeof PRCIGateNameSchema>;

export const ReleaseOnlyCIGateNameSchema = z.enum([
  'full-golden-suite',
  'live-provider-canary',
  'default-pack-evaluation',
  'knowledge-refresh-canary',
  'large-index-performance'
]);
export type ReleaseOnlyCIGateName = z.infer<typeof ReleaseOnlyCIGateNameSchema>;

export const CIGateNameSchema = z.union([
  PRCIGateNameSchema,
  ReleaseOnlyCIGateNameSchema
]);
export type CIGateName = z.infer<typeof CIGateNameSchema>;

export interface CIGateDefinition {
  name: CIGateName;
  scope: CIGateScope;
  description: string;
  timeoutSeconds: number;
  allowsExternalDownloads: boolean;
  requiredForMerge: boolean;
}

export interface CIGateExecutionResult {
  gate: CIGateName;
  scope: CIGateScope;
  passed: boolean;
  durationMs: number;
  message?: string;
  violation?: string;
}

export interface CIPipelineReport {
  timestamp: string;
  scope: CIGateScope;
  totalGates: number;
  passedCount: number;
  failedCount: number;
  results: CIGateExecutionResult[];
  allPassed: boolean;
  blockedByDownloadViolation: boolean;
}
