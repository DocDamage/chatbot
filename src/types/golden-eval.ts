/**
 * Golden Conversation and Runtime Regression Schemas (CRK-P24-T01 to T07)
 *
 * Provides schemas for the 12 golden evaluation categories, deterministic assertions,
 * contamination isolation flags, and baseline metrics tracking.
 */

import { z } from 'zod';

export const goldenSuiteCategorySchema = z.enum([
  'conversation_followup',
  'coding',
  'debugging',
  'repository_project',
  'research_factual',
  'rag_grounding',
  'memory_state',
  'workflow',
  'tool_truthfulness',
  'provider_fallback',
  'permissions_refusal',
  'malformed_input',
]);

export type GoldenSuiteCategory = z.infer<typeof goldenSuiteCategorySchema>;

export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const sourceExpectationSchema = z.object({
  expectedPackId: z.string().optional(),
  expectedSourceSubstring: z.string().optional(),
  minCitations: z.number().int().nonnegative().default(0),
  maxCitations: z.number().int().positive().optional(),
});

export type SourceExpectation = z.infer<typeof sourceExpectationSchema>;

export const toolExpectationSchema = z.object({
  toolName: z.string().min(1),
  expectedStatus: z.enum(['success', 'failed', 'blocked', 'not_run']),
  mustVerify: z.boolean().default(false),
});

export type ToolExpectation = z.infer<typeof toolExpectationSchema>;

export const deterministicAssertionSchema = z.object({
  type: z.enum([
    'route_matches',
    'pack_selected',
    'tool_state_matches',
    'contains_substring',
    'not_contains_substring',
    'no_overclaim',
    'variable_retained',
    'refusal_detected',
  ]),
  param: z.string().optional(),
  expectedValue: z.unknown().optional(),
});

export type DeterministicAssertion = z.infer<typeof deterministicAssertionSchema>;

export const goldenCaseSchema = z.object({
  id: z.string().min(1),
  category: goldenSuiteCategorySchema,
  input: z.array(chatTurnSchema).min(1),
  setup: z.record(z.unknown()).optional(),
  requiredBehaviors: z.array(z.string()).default([]),
  prohibitedBehaviors: z.array(z.string()).default([]),
  expectedSources: z.array(sourceExpectationSchema).optional(),
  expectedToolStates: z.array(toolExpectationSchema).optional(),
  deterministicAssertions: z.array(deterministicAssertionSchema).default([]),
  isolatedFromKnowledgeIndex: z.boolean().default(true),
});

export type GoldenCase = z.infer<typeof goldenCaseSchema>;

export const baselineMetricsSchema = z.object({
  totalCases: z.number().int().nonnegative(),
  passedCases: z.number().int().nonnegative(),
  taskSuccessRate: z.number().min(0).max(1),
  routingAccuracy: z.number().min(0).max(1),
  retrievalRecall: z.number().min(0).max(1),
  citationCorrectness: z.number().min(0).max(1),
  unsupportedClaimRate: z.number().min(0).max(1),
  toolTruthfulnessRate: z.number().min(0).max(1),
  latencyP95Ms: z.number().nonnegative(),
});

export type BaselineMetrics = z.infer<typeof baselineMetricsSchema>;
