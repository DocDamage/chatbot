/**
 * Context Plan Schemas and Types (CRK-P05-T01)
 *
 * Defines the structured plan generated before retrieval or prompt assembly,
 * specifying precisely what context resources a request requires.
 */

import { z } from 'zod';

export const conversationRequirementSchema = z.object({
  type: z.literal('conversation'),
  maxTokens: z.number().int().positive().default(4000),
});

export const variablesRequirementSchema = z.object({
  type: z.literal('variables'),
  keys: z.array(z.string()),
});

export const memoryRequirementSchema = z.object({
  type: z.literal('memory'),
  scopes: z.array(z.string()).default(['episodic', 'semantic']),
  maxItems: z.number().int().positive().default(5),
});

export const projectRequirementSchema = z.object({
  type: z.literal('project'),
  paths: z.array(z.string()).optional(),
  strategy: z.enum(['structural', 'targeted']).optional().default('structural'),
  focusSymbols: z.array(z.string()).optional(),
  includeDiagnostics: z.boolean().optional().default(true),
  includeTests: z.boolean().optional().default(false),
});

export const knowledgeRequirementSchema = z.object({
  type: z.literal('knowledge'),
  packs: z.array(z.string()),
  query: z.string(),
  filters: z.record(z.unknown()).optional().default({}),
  maxChunks: z.number().int().positive().optional().default(5),
});

export const toolRequirementSchema = z.object({
  type: z.literal('tool'),
  toolId: z.string(),
  reason: z.string(),
});

export const noneRequirementSchema = z.object({
  type: z.literal('none'),
  reason: z.string(),
});

export const contextRequirementSchema = z.discriminatedUnion('type', [
  conversationRequirementSchema,
  variablesRequirementSchema,
  memoryRequirementSchema,
  projectRequirementSchema,
  knowledgeRequirementSchema,
  toolRequirementSchema,
  noneRequirementSchema,
]);

export type ContextRequirement = z.infer<typeof contextRequirementSchema>;
export type ConversationRequirement = z.infer<typeof conversationRequirementSchema>;
export type VariablesRequirement = z.infer<typeof variablesRequirementSchema>;
export type MemoryRequirement = z.infer<typeof memoryRequirementSchema>;
export type ProjectRequirement = z.infer<typeof projectRequirementSchema>;
export type KnowledgeRequirement = z.infer<typeof knowledgeRequirementSchema>;
export type ToolRequirement = z.infer<typeof toolRequirementSchema>;
export type NoneRequirement = z.infer<typeof noneRequirementSchema>;

export const skippedRequirementSchema = z.object({
  type: z.string(),
  reason: z.string(),
});

export type SkippedRequirement = z.infer<typeof skippedRequirementSchema>;

export const contextPlanSchema = z.object({
  requestId: z.string().min(1),
  requirements: z.array(contextRequirementSchema),
  answerReserveTokens: z.number().int().positive().default(2000),
  rationaleCodes: z.array(z.string()).default([]),
  skippedRequirements: z.array(skippedRequirementSchema).optional(),
  tokenBudgets: z.record(z.number()).optional(),
  confidence: z.number().min(0).max(1).default(1.0),
});

export type ContextPlan = z.infer<typeof contextPlanSchema>;

export interface ClassifierResult {
  task: string;
  needsProject: boolean;
  needsKnowledge: boolean;
  knowledgeDomains: string[];
  needsWeb: boolean;
  confidence: number;
}
