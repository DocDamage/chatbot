/**
 * Canonical Feedback Schemas & Types (CRK Phase 16)
 *
 * Defines unified feedback event contracts, trace binding metadata,
 * failure categorization, and evaluation candidate models.
 *
 * In accordance with §2845, full private prompt text is never duplicated into
 * feedback records. In accordance with §2874, feedback cannot directly trigger
 * model fine-tuning or automatic weights updates.
 */

import { z } from 'zod';

export const feedbackCategorySchema = z.enum([
  'incorrect',
  'instruction_failure',
  'outdated',
  'misunderstood',
  'bad_code',
  'too_verbose',
  'too_short',
  'wrong_source',
  'tool_failed',
  'citation_problem',
  'other',
]);

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export const feedbackEventSchema = z.object({
  id: z.string().min(1),
  responseId: z.string().min(1),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]).optional(),
  thumbs: z.enum(['up', 'down']).optional(),
  categories: z.array(feedbackCategorySchema).default([]),
  comment: z.string().max(4000).optional(),
  createdAt: z.string().datetime().or(z.string()),
});

export type FeedbackEvent = z.infer<typeof feedbackEventSchema>;
export type FeedbackEventInput = z.input<typeof feedbackEventSchema>;

export const feedbackTraceBindingMetadataSchema = z.object({
  promptVersion: z.string().min(1),
  botProfileVersion: z.string().min(1),
  model: z.string().min(1),
  provider: z.string().min(1),
  modelPolicy: z.string().min(1),
  contextPlanId: z.string().optional(),
  retrievalPolicy: z.string().optional(),
  selectedDatasetVersions: z.record(z.string()).default({}),
  toolResults: z.array(z.object({
    toolName: z.string().min(1),
    status: z.string().min(1),
    durationMs: z.number().nonnegative().optional(),
  })).default([]),
  latencyMs: z.number().nonnegative().optional(),
  validationWarnings: z.array(z.string()).default([]),
});

export type FeedbackTraceBindingMetadata = z.infer<typeof feedbackTraceBindingMetadataSchema>;

export const enrichedFeedbackRecordSchema = z.object({
  id: z.string().min(1),
  event: feedbackEventSchema,
  trace: feedbackTraceBindingMetadataSchema,
  createdAt: z.string().datetime().or(z.string()),
});

export type EnrichedFeedbackRecord = z.infer<typeof enrichedFeedbackRecordSchema>;

export const evaluationCandidateRecordSchema = z.object({
  id: z.string().min(1),
  feedbackId: z.string().min(1),
  responseId: z.string().min(1),
  sessionId: z.string().min(1),
  failureCategories: z.array(feedbackCategorySchema).min(1),
  status: z.enum(['candidate', 'verified', 'regression_added', 'dismissed']),
  reviewNotes: z.string().optional(),
  createdAt: z.string().datetime().or(z.string()),
});

export type EvaluationCandidateRecord = z.infer<typeof evaluationCandidateRecordSchema>;
