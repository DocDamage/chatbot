/**
 * Standard Tool Result & Side-Effect Ledger Types (CRK-P18-T01, T02)
 *
 * Defines explicit typed contracts for tool execution truthfulness (§2989-3025):
 * - ToolStatus: 'success' | 'failed' | 'blocked' | 'cancelled' | 'partial' | 'not_run'
 * - CanonicalToolResult (§2994-3010)
 * - SideEffectLedgerEntry (§3013-3025)
 * - Allowed language matrix types (§3028-3039)
 *
 * Strictly adheres to the < 300 lines per file rule (§494).
 */

import { z } from 'zod';

export const toolExecutionStatusSchema = z.enum([
  'success',
  'failed',
  'blocked',
  'cancelled',
  'partial',
  'not_run',
]);

export type ToolExecutionStatus = z.infer<typeof toolExecutionStatusSchema>;

export const toolVerificationStatusSchema = z.enum(['verified', 'unverified', 'failed']);
export type ToolVerificationStatus = z.infer<typeof toolVerificationStatusSchema>;

export const toolOutputRefSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['file', 'diff', 'text', 'json', 'artifact']),
  uri: z.string().optional(),
  path: z.string().optional(),
  summary: z.string().optional(),
});

export type ToolOutputRef = z.infer<typeof toolOutputRefSchema>;

export const toolErrorRefSchema = z.object({
  code: z.string().min(1),
  safeMessage: z.string().min(1),
});

export type ToolErrorRef = z.infer<typeof toolErrorRefSchema>;

export const toolVerificationRefSchema = z.object({
  status: toolVerificationStatusSchema,
  evidence: z.array(z.string()).default([]),
});

export type ToolVerificationRef = z.infer<typeof toolVerificationRefSchema>;

export const canonicalToolResultSchema = z.object({
  toolCallId: z.string().min(1),
  toolId: z.string().min(1),
  status: toolExecutionStatusSchema,
  startedAt: z.string().datetime().or(z.string()).optional(),
  completedAt: z.string().datetime().or(z.string()).optional(),
  inputsDigest: z.string().min(1),
  outputs: z.array(toolOutputRefSchema).optional().default([]),
  error: toolErrorRefSchema.optional(),
  verification: toolVerificationRefSchema.optional(),
});

export interface CanonicalToolResult {
  toolCallId: string;
  toolId: string;
  status: ToolExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  inputsDigest: string;
  outputs?: ToolOutputRef[];
  error?: ToolErrorRef;
  verification?: ToolVerificationRef;
}

export const sideEffectStatusSchema = z.enum(['pending', 'applied', 'failed', 'rolled_back']);
export type SideEffectStatus = z.infer<typeof sideEffectStatusSchema>;

export const sideEffectLedgerEntrySchema = z.object({
  ledgerId: z.string().min(1),
  sessionId: z.string().min(1),
  toolCallId: z.string().min(1),
  actor: z.string().min(1),
  authorizationId: z.string().min(1),
  inputHash: z.string().min(1),
  exactTarget: z.string().min(1),
  status: sideEffectStatusSchema,
  changedResources: z.array(z.string()).default([]),
  rollbackInfo: z
    .object({
      mechanism: z.enum(['git_revert', 'file_restore', 'inverse_patch', 'custom']),
      backupPath: z.string().optional(),
      snapshotDigest: z.string().optional(),
      instructions: z.string().optional(),
    })
    .optional(),
  verification: toolVerificationRefSchema.default({ status: 'unverified', evidence: [] }),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});

export type SideEffectLedgerEntry = z.infer<typeof sideEffectLedgerEntrySchema>;

/**
 * Standard allowed phrase mappings for tool statuses (§3030-3039).
 */
export const STATUS_ALLOWED_LANGUAGE: Record<ToolExecutionStatus, string> = {
  success: 'completed',
  failed: 'failed',
  blocked: 'could not run due to policy/permission',
  cancelled: 'cancelled',
  partial: 'partially completed',
  not_run: 'proposed/planned only',
};
