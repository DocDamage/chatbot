/**
 * Citation and Provenance UX Types (CRK Phase 15)
 *
 * Provides schemas and typed interfaces for structured citations, claim-source
 * associations, sources drawer cards, and privacy-preserving retrieval diagnostics.
 *
 * In accordance with §2758, internal chain-of-thought and private model reasoning
 * are strictly excluded from these schemas.
 */

import { z } from 'zod';

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
  score: z.number().min(0).max(1).optional(),
});

export type CitationRef = z.infer<typeof citationRefSchema>;

export const claimSourceAssociationSchema = z.object({
  claimId: z.string().min(1),
  claimText: z.string().min(1),
  citationIds: z.array(z.string().min(1)).min(1),
  chunkIds: z.array(z.string().min(1)).min(1),
  sourceId: z.string().min(1),
  datasetId: z.string().optional(),
  version: z.string().optional(),
  level: z.enum(['sentence', 'response']),
  confidence: z.number().min(0).max(1),
});

export type ClaimSourceAssociation = z.infer<typeof claimSourceAssociationSchema>;

export const sourceCardCategorySchema = z.enum([
  'official_docs',
  'repo_evidence',
  'developer_qa',
  'general_knowledge',
  'other',
]);

export type SourceCardCategory = z.infer<typeof sourceCardCategorySchema>;

export const sourceCardActionSchema = z.object({
  type: z.enum(['open_url', 'open_file', 'none']),
  target: z.string().optional(),
  label: z.string(),
});

export type SourceCardAction = z.infer<typeof sourceCardActionSchema>;

export const sourceCardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: sourceCardCategorySchema,
  categoryLabel: z.string(),
  version: z.string().optional(),
  authority: z.number().min(0).max(1).optional(),
  sourceUrl: z.string().url().optional(),
  path: z.string().optional(),
  snippet: z.string().optional(),
  badges: z.array(z.string()).default([]),
  action: sourceCardActionSchema,
});

export type SourceCard = z.infer<typeof sourceCardSchema>;

export const sourcesDrawerDataSchema = z.object({
  totalSources: z.number().int().nonnegative(),
  compactLabel: z.string(),
  cards: z.array(sourceCardSchema),
  unresolvedCitations: z.array(z.string()).default([]),
});

export type SourcesDrawerData = z.infer<typeof sourcesDrawerDataSchema>;

export const whyThisAnswerDiagnosticsSchema = z.object({
  requestId: z.string().min(1),
  traceId: z.string().min(1),
  selectedIntent: z.string().min(1),
  taskType: z.string().min(1),
  contextTypes: z.array(z.string()).default([]),
  packIds: z.array(z.string()).default([]),
  retrievalCandidateCount: z.number().int().nonnegative(),
  selectedSourceCount: z.number().int().nonnegative(),
  modelRoute: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    policy: z.string().min(1),
    fallbackUsed: z.boolean().default(false),
  }),
  toolStatus: z.array(z.object({
    toolName: z.string().min(1),
    status: z.string().min(1),
    summary: z.string().optional(),
  })).default([]),
  promptPolicyVersion: z.string().min(1),
  retrievalPolicyVersion: z.string().min(1),
  botProfileVersion: z.string().min(1),
  warnings: z.array(z.string()).default([]),
});

export type WhyThisAnswerDiagnostics = z.infer<typeof whyThisAnswerDiagnosticsSchema>;
