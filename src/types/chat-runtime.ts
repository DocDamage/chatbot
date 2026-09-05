/**
 * Canonical Chat Runtime Types & Schemas
 *
 * Provides typed contracts and runtime validation schemas for the canonical
 * ChatRuntime pipeline, including request normalization, context planning,
 * execution results, citations, tool results, and tracing.
 *
 * In accordance with CRK Phase 01 security and privacy boundaries, internal
 * chain-of-thought and private model reasoning are never exposed in these contracts.
 */

import { z } from 'zod';
import { contextPlanSchema, ContextPlan } from './context-plan';

// ============================================================================
// Context & Sub-Schemas
// ============================================================================

export const loadedFileContextSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  language: z.string().optional(),
  size: z.number().nonnegative().optional(),
}).passthrough();

export type LoadedFileContext = z.infer<typeof loadedFileContextSchema>;

export const loadedAudioContextSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  format: z.string().optional(),
  duration: z.number().nonnegative().optional(),
  sampleRate: z.number().positive().optional(),
  channels: z.number().int().positive().optional(),
}).passthrough();

export type LoadedAudioContext = z.infer<typeof loadedAudioContextSchema>;

export const activePlanContextSchema = z.object({
  id: z.string().min(1).max(200),
  content: z.string().max(100000),
});

export type ActivePlanContext = z.infer<typeof activePlanContextSchema>;

export const clientCapabilitiesSchema = z.object({
  streaming: z.boolean().default(false),
  citations: z.boolean().default(false),
  toolApproval: z.boolean().default(false),
});

export type ClientCapabilities = z.infer<typeof clientCapabilitiesSchema>;

// ============================================================================
// NormalizedChatRequest
// ============================================================================

export const normalizedChatRequestSchema = z.object({
  requestId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  userId: z.string().max(128).optional(),
  message: z.string().trim().min(1).max(50000),
  mode: z.string().max(100).optional(),
  botProfileId: z.string().min(1).max(100).default('default'),
  explicitSystemInstruction: z.string().max(16000).optional(),
  loadedFiles: z.array(loadedFileContextSchema).default([]),
  loadedAudio: z.array(loadedAudioContextSchema).default([]),
  activePlan: activePlanContextSchema.optional(),
  clientCapabilities: clientCapabilitiesSchema.default({
    streaming: false,
    citations: false,
    toolApproval: false,
  }),
  requestedModelPolicy: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type NormalizedChatRequest = z.infer<typeof normalizedChatRequestSchema>;

// ============================================================================
// CitationRef & ToolResultSummary
// ============================================================================

export const citationRefSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  datasetId: z.string().optional(),
  title: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  path: z.string().optional(),
  version: z.string().optional(),
  chunkId: z.string().min(1),
  quoteStart: z.number().int().nonnegative().optional(),
  quoteEnd: z.number().int().nonnegative().optional(),
  authority: z.number().min(0).max(1).optional(),
});

export type CitationRef = z.infer<typeof citationRefSchema>;

export const toolResultSummarySchema = z.object({
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(['success', 'failed', 'requires_approval']),
  summary: z.string().optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});

export type ToolResultSummary = z.infer<typeof toolResultSummarySchema>;

export const modelExecutionMetadataSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  policy: z.string().min(1),
  fallbackUsed: z.boolean().default(false),
});

export type ModelExecutionMetadata = z.infer<typeof modelExecutionMetadataSchema>;

export const groundingSummarySchema = z.object({
  attempted: z.boolean(),
  sufficient: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
});

export type GroundingSummary = z.infer<typeof groundingSummarySchema>;

// ============================================================================
// ChatRuntimeResult
// ============================================================================

export const chatRuntimeResultSchema = z.object({
  requestId: z.string().min(1),
  response: z.string(),
  model: modelExecutionMetadataSchema,
  citations: z.array(citationRefSchema).default([]),
  toolResults: z.array(toolResultSummarySchema).default([]),
  warnings: z.array(z.string()).default([]),
  latencyMs: z.number().nonnegative(),
  traceId: z.string().min(1),
  grounding: groundingSummarySchema,
});

export type ChatRuntimeResult = z.infer<typeof chatRuntimeResultSchema>;

// ============================================================================
// TaskClassificationResult & ChatContextPlan
// ============================================================================

export const taskClassificationResultSchema = z.object({
  taskType: z.string().min(1),
  intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  specialistDomain: z.string().optional(),
  heuristicSignals: z.array(z.string()).default([]),
  requiresTools: z.boolean().default(false),
  requiresGrounding: z.boolean().default(false),
});

export type TaskClassificationResult = z.infer<typeof taskClassificationResultSchema>;

export const chatContextPlanSchema = z.object({
  requestId: z.string().min(1),
  traceId: z.string().min(1),
  taskClassification: taskClassificationResultSchema,
  retrievalStrategy: z.object({
    useRAG: z.boolean(),
    packIds: z.array(z.string()).optional(),
    maxSources: z.number().int().positive().optional(),
    minRelevanceScore: z.number().min(0).max(1).optional(),
  }),
  memoryStrategy: z.object({
    includeHistory: z.boolean(),
    maxMessages: z.number().int().positive().optional(),
    includeVariables: z.boolean().optional(),
  }),
  toolStrategy: z.object({
    enabledTools: z.array(z.string()).optional(),
    requireApproval: z.boolean().optional(),
  }),
  modelStrategy: z.object({
    policy: z.string(),
    preferredModel: z.string().optional(),
    fallbackModel: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }),
  budgetLimits: z.object({
    maxContextTokens: z.number().int().positive().optional(),
    maxOutputTokens: z.number().int().positive().optional(),
  }).optional(),
  structuredPlan: contextPlanSchema.optional(),
});

export type ChatContextPlan = z.infer<typeof chatContextPlanSchema>;

// ============================================================================
// ChatTraceContext
// ============================================================================

export const chatTraceContextSchema = z.object({
  traceId: z.string().min(1),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  parentSpanId: z.string().optional(),
  stageTimings: z.record(z.number().nonnegative()).default({}),
  createdAt: z.string().datetime().or(z.string()),
});

export type ChatTraceContext = z.infer<typeof chatTraceContextSchema>;
export type { ContextPlan };
