/**
 * Canonical Conversation State & Variable Schemas
 *
 * Defines explicit typed contracts for conversation state layers (§969-991)
 * and structured conversation variables (§993-1029).
 *
 * State Layers:
 * - TurnContext: ephemeral; current request only
 * - ConversationVariable: structured values for active conversation
 * - SessionMemory: recent conversational continuity
 * - EpisodicMemory: durable milestones/decisions when policy allows
 * - UserMemory: user-approved durable preferences/facts
 * - CanonicalKnowledge: source-of-truth reference documents/data
 */

import { z } from 'zod';

export const variableSourceSchema = z.enum(['explicit', 'inferred', 'tool', 'project']);
export type VariableSource = z.infer<typeof variableSourceSchema>;

export const supportedVariableKeySchema = z.enum([
  'userGoal',
  'currentProject',
  'repository',
  'workspaceRoot',
  'programmingLanguage',
  'framework',
  'frameworkVersion',
  'runtimeVersion',
  'operatingSystem',
  'targetPlatform',
  'requestedOutput',
  'currentTask',
  'activeArtifact',
  'activePlanId',
  'selectedMode',
  'selectedKnowledgePack',
  'selectedModelPolicy',
]);

export type SupportedVariableKey = z.infer<typeof supportedVariableKeySchema>;

export const conversationVariableSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.any(),
  confidence: z.number().min(0).max(1),
  sourceTurnId: z.string().min(1).max(128),
  source: variableSourceSchema,
  updatedAt: z.string().datetime().or(z.string().min(1)),
  expiresAt: z.string().datetime().or(z.string().min(1)).optional(),
});

export interface ConversationVariable<T = unknown> {
  key: string;
  value: T;
  confidence: number;
  sourceTurnId: string;
  source: VariableSource;
  updatedAt: string;
  expiresAt?: string;
}

export const turnContextSchema = z.object({
  turnId: z.string().min(1),
  requestId: z.string().min(1),
  userInput: z.string(),
  receivedAt: z.string().datetime().or(z.string()),
  transientDirectives: z.record(z.unknown()).default({}),
});

export type TurnContext = z.infer<typeof turnContextSchema>;

export const sessionMemoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  turnId: z.string().optional(),
  timestamp: z.string().datetime().or(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SessionMemoryMessage = z.infer<typeof sessionMemoryMessageSchema>;

export const sessionMemorySchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(sessionMemoryMessageSchema).default([]),
  maxHistoryTurns: z.number().int().positive().default(50),
});

export type SessionMemory = z.infer<typeof sessionMemorySchema>;

export const episodicMemoryItemSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  milestone: z.string().min(1),
  decision: z.string().optional(),
  createdAt: z.string().datetime().or(z.string()),
  tags: z.array(z.string()).default([]),
});

export type EpisodicMemoryItem = z.infer<typeof episodicMemoryItemSchema>;

export const userMemoryItemSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  userApproved: z.literal(true),
  category: z.string().default('preference'),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});

export type UserMemoryItem = z.infer<typeof userMemoryItemSchema>;

export const canonicalKnowledgeRefSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  authority: z.number().min(0).max(1),
  packId: z.string().optional(),
  version: z.string().optional(),
});

export type CanonicalKnowledgeRef = z.infer<typeof canonicalKnowledgeRefSchema>;

export const conversationStateSchema = z.object({
  sessionId: z.string().min(1),
  variables: z.record(conversationVariableSchema).default({}),
  sessionMemory: sessionMemorySchema,
  turnContext: turnContextSchema.optional(),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});

export type ConversationState = z.infer<typeof conversationStateSchema>;
