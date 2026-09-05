/**
 * Response Validation Contract Types & Schemas (CRK-P17-T01)
 *
 * Defines explicit typed contracts for validating assistant responses:
 * - ResponseValidation: severity, violation codes, retry recommendations, corrected response (§2916-2923)
 * - RemediationAction: reason-specific remediation routing (§2964-2974)
 * - ResponseValidationContext: contextual signals required by validators
 */

import { z } from 'zod';
import {
  citationRefSchema,
  CitationRef,
  toolResultSummarySchema,
  ToolResultSummary,
  modelExecutionMetadataSchema,
  ModelExecutionMetadata,
  groundingSummarySchema,
  GroundingSummary,
} from './chat-runtime';

export const validationSeveritySchema = z.enum(['info', 'warning', 'error']);
export type ValidationSeverity = z.infer<typeof validationSeveritySchema>;

export const remediationActionSchema = z.enum([
  'none',
  'retry_model',
  'remediate_tool',
  'broaden_retrieval',
  'abstain',
]);
export type RemediationAction = z.infer<typeof remediationActionSchema>;

export const validationIssueSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: validationSeveritySchema,
  field: z.string().optional(),
  suggestedFix: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const responseValidationSchema = z.object({
  valid: z.boolean(),
  severity: validationSeveritySchema,
  codes: z.array(z.string()).default([]),
  retryRecommended: z.boolean().default(false),
  remediationAction: remediationActionSchema.default('none'),
  correctedResponse: z.string().optional(),
  issues: z.array(validationIssueSchema).default([]),
});

export type ResponseValidation = z.infer<typeof responseValidationSchema>;

export interface ResponseValidationContext {
  requestId: string;
  response: string;
  userMessage: string;
  taskType?: string;
  intent?: string;
  requiresGrounding?: boolean;
  requiresTools?: boolean;
  model?: ModelExecutionMetadata;
  citations?: CitationRef[];
  toolResults?: ToolResultSummary[];
  grounding?: GroundingSummary;
  retrievedChunks?: Array<{
    chunkId: string;
    sourceId: string;
    title: string;
    content: string;
    authority?: number;
    sourceUrl?: string;
    version?: string;
  }>;
  expectedFormat?: 'json' | 'markdown' | 'code' | 'text';
  isCodingTask?: boolean;
}

export const responseValidationContextSchema = z.object({
  requestId: z.string().min(1),
  response: z.string(),
  userMessage: z.string(),
  taskType: z.string().optional(),
  intent: z.string().optional(),
  requiresGrounding: z.boolean().optional(),
  requiresTools: z.boolean().optional(),
  model: modelExecutionMetadataSchema.optional(),
  citations: z.array(citationRefSchema).optional(),
  toolResults: z.array(toolResultSummarySchema).optional(),
  grounding: groundingSummarySchema.optional(),
  retrievedChunks: z
    .array(
      z.object({
        chunkId: z.string(),
        sourceId: z.string(),
        title: z.string(),
        content: z.string(),
        authority: z.number().optional(),
        sourceUrl: z.string().optional(),
        version: z.string().optional(),
      })
    )
    .optional(),
  expectedFormat: z.enum(['json', 'markdown', 'code', 'text']).optional(),
  isCodingTask: z.boolean().optional(),
});
