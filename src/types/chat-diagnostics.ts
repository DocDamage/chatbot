/**
 * Chat Diagnostics & Run Record Schemas (CRK-P23-T01, T02, T05)
 *
 * Defines typed records for chat runs, stage timings, failure taxonomies, and developer diagnostics.
 * In accordance with §3433, internal chain-of-thought, private user tokens, and secret keys
 * are never stored in these records.
 */

import { z } from 'zod';

export const chatRunStatusSchema = z.enum(['success', 'failed', 'blocked', 'cancelled']);
export type ChatRunStatus = z.infer<typeof chatRunStatusSchema>;

export const failureTaxonomyCodeSchema = z.enum([
  'REQUEST_INVALID',
  'AUTH_BLOCKED',
  'CONTEXT_PLANNING_FAILED',
  'KNOWLEDGE_PACK_UNAVAILABLE',
  'RETRIEVAL_EMPTY',
  'GROUNDING_INSUFFICIENT',
  'MODEL_UNAVAILABLE',
  'MODEL_TIMEOUT',
  'MODEL_RATE_LIMITED',
  'TOOL_BLOCKED',
  'TOOL_FAILED',
  'VALIDATION_FAILED',
  'PERSISTENCE_FAILED',
  'CANCELLED',
]);

export type FailureTaxonomyCode = z.infer<typeof failureTaxonomyCodeSchema>;

export const stageTimingsSchema = z.object({
  normalizeMs: z.number().nonnegative().optional(),
  stateLoadMs: z.number().nonnegative().optional(),
  classificationMs: z.number().nonnegative().optional(),
  contextPlanningMs: z.number().nonnegative().optional(),
  retrievalMs: z.number().nonnegative().optional(),
  modelSelectionMs: z.number().nonnegative().optional(),
  generationMs: z.number().nonnegative().optional(),
  validationMs: z.number().nonnegative().optional(),
  toolExecutionMs: z.number().nonnegative().optional(),
  persistenceMs: z.number().nonnegative().optional(),
});

export type StageTimings = z.infer<typeof stageTimingsSchema>;

export const chatRunRecordSchema = z.object({
  requestId: z.string().min(1),
  traceId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: chatRunStatusSchema,
  taskType: z.string().min(1),
  intent: z.string().optional(),
  workflowId: z.string().optional(),
  botProfileVersion: z.string().default('default-v1.0'),
  contextPlanSummary: z.record(z.unknown()).default({}),
  retrievalPolicyVersion: z.string().optional(),
  modelPolicyVersion: z.string().default('default-policy-v1'),
  selectedModel: z.object({
    provider: z.string(),
    model: z.string(),
    fallbackUsed: z.boolean().default(false),
  }).optional(),
  selectedSourceIds: z.array(z.string()).default([]),
  toolCallIds: z.array(z.string()).default([]),
  validationCodes: z.array(z.string()).default([]),
  failureCode: failureTaxonomyCodeSchema.optional(),
  failureMessage: z.string().optional(),
  stageTimings: stageTimingsSchema.default({}),
  latencyMs: z.number().nonnegative().optional(),
});

export type ChatRunRecord = z.infer<typeof chatRunRecordSchema>;
