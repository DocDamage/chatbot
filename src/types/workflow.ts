/**
 * Canonical Workflow Types & Schemas (CRK-P04-T01)
 *
 * Defines explicit typed contracts for guided workflows (§1105-1130):
 * - Step types: capture-variable, retrieve-knowledge, call-model, call-tool,
 *   condition, approval, verify, emit, end.
 * - WorkflowDefinition & WorkflowStepDefinition
 * - WorkflowExecutionState & ToolApprovalRequest
 */

import { z } from 'zod';

export const workflowStepTypeSchema = z.enum([
  'capture-variable',
  'retrieve-knowledge',
  'call-model',
  'call-tool',
  'condition',
  'approval',
  'verify',
  'emit',
  'end',
]);

export type WorkflowStepType = z.infer<typeof workflowStepTypeSchema>;

export const workflowTransitionSchema = z.object({
  condition: z.string().min(1),
  targetStepId: z.string().min(1),
});

export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>;

export const workflowStepDefinitionSchema = z.object({
  id: z.string().min(1).max(100),
  type: workflowStepTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()).default({}),
  nextStepId: z.string().max(100).optional(),
  transitions: z.array(workflowTransitionSchema).default([]),
});

export type WorkflowStepDefinition = z.infer<typeof workflowStepDefinitionSchema>;

export const workflowDefinitionSchema = z.object({
  id: z.string().min(1).max(100),
  version: z.number().int().positive().default(1),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  intents: z.array(z.string().min(1)).min(1),
  startStep: z.string().min(1),
  steps: z.record(workflowStepDefinitionSchema),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export const toolApprovalBindingSchema = z.object({
  stepId: z.string().min(1),
  operation: z.string().min(1),
  toolName: z.string().min(1),
  inputHash: z.string().min(1),
  targetPaths: z.array(z.string()).default([]),
  allowedSideEffects: z.array(z.string()).default([]),
  approvalToken: z.string().min(1),
  expiresAt: z.string().datetime().or(z.string().min(1)),
});

export type ToolApprovalBinding = z.infer<typeof toolApprovalBindingSchema>;

export const workflowExecutionStatusSchema = z.enum([
  'running',
  'waiting_approval',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>;

export const workflowExecutionStateSchema = z.object({
  sessionId: z.string().min(1),
  workflowId: z.string().min(1),
  version: z.number().int().positive(),
  activeStepId: z.string().min(1),
  status: workflowExecutionStatusSchema.default('running'),
  stepOutputs: z.record(z.unknown()).default({}),
  pendingApproval: toolApprovalBindingSchema.optional(),
  approvals: z
    .record(
      z.object({
        approved: z.boolean(),
        token: z.string(),
        timestamp: z.string(),
      })
    )
    .default({}),
  failures: z
    .array(
      z.object({
        stepId: z.string(),
        error: z.string(),
        timestamp: z.string(),
      })
    )
    .default([]),
  cancelled: z.boolean().default(false),
  cancelReason: z.string().optional(),
  startedAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});

export type WorkflowExecutionState = z.infer<typeof workflowExecutionStateSchema>;
