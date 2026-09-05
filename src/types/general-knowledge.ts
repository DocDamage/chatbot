/**
 * General Knowledge Pack Schemas & Interfaces (CRK Phase 19: CRK-P19-T01 to T05)
 *
 * Defines schemas for Wikipedia articles/sections, structured Wikidata entities,
 * entity linking results, and versioned snapshot metadata.
 */

import { z } from 'zod';

export const wikipediaNamespaceSchema = z.enum([
  'main',
  'category',
  'template',
  'file',
  'portal',
  'help',
]);

export type WikipediaNamespace = z.infer<typeof wikipediaNamespaceSchema>;

export const wikipediaSectionChunkSchema = z.object({
  chunkId: z.string().min(1),
  articleId: z.string().min(1),
  articleTitle: z.string().min(1),
  canonicalTitle: z.string().optional(),
  sectionTitle: z.string(),
  sectionAnchor: z.string(),
  sectionLevel: z.number().int().min(1).max(6),
  leadParagraph: z.boolean().default(false),
  content: z.string().min(1),
  wordCount: z.number().int().min(0),
  language: z.string().default('en'),
  sourceUrl: z.string().url(),
  revisionId: z.string(),
  wikidataEntityId: z.string().optional(),
  authority: z.number().min(0).max(1).default(0.67),
  extractedAt: z.string(),
});

export type WikipediaSectionChunk = z.infer<typeof wikipediaSectionChunkSchema>;

export const wikipediaArticleSchema = z.object({
  articleId: z.string().min(1),
  title: z.string().min(1),
  canonicalTitle: z.string().optional(),
  language: z.string().default('en'),
  namespace: wikipediaNamespaceSchema.default('main'),
  revisionId: z.string(),
  sourceUrl: z.string().url(),
  wikidataEntityId: z.string().optional(),
  summary: z.string(),
  sections: z.array(wikipediaSectionChunkSchema).default([]),
  categories: z.array(z.string()).default([]),
  redirects: z.array(z.string()).default([]),
  lastModified: z.string().optional(),
});

export type WikipediaArticle = z.infer<typeof wikipediaArticleSchema>;

export const wikidataClaimSchema = z.object({
  propertyId: z.string().regex(/^P\d+$/, 'Property ID must follow P### format'),
  propertyName: z.string().optional(),
  datatype: z.enum(['string', 'entity', 'quantity', 'time', 'url', 'monolingualtext']),
  value: z.any(),
  valueLabel: z.string().optional(),
  references: z.array(z.string()).default([]),
  rank: z.enum(['preferred', 'normal', 'deprecated']).default('normal'),
});

export type WikidataClaim = z.infer<typeof wikidataClaimSchema>;

export const wikidataEntitySchema = z.object({
  entityId: z.string().regex(/^Q\d+$/, 'Wikidata Entity ID must follow Q### format'),
  label: z.string().min(1),
  description: z.string().default(''),
  aliases: z.array(z.string()).default([]),
  instanceOf: z.array(z.string()).default([]),
  subclassOf: z.array(z.string()).default([]),
  claims: z.array(wikidataClaimSchema).default([]),
  wikipediaUrl: z.string().url().optional(),
  provenance: z.object({
    source: z.literal('wikidata'),
    snapshotVersion: z.string(),
    license: z.string().default('CC0-1.0'),
  }),
});

export type WikidataEntity = z.infer<typeof wikidataEntitySchema>;

export const entityLinkResultSchema = z.object({
  textSpan: z.string(),
  entityId: z.string(),
  entityLabel: z.string(),
  confidence: z.number().min(0).max(1),
  isLinked: z.boolean(),
  matchType: z.enum(['exact_label', 'alias', 'contextual_disambiguation', 'unmatched']),
});

export type EntityLinkResult = z.infer<typeof entityLinkResultSchema>;

export const generalKnowledgeSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  version: z.string().min(1),
  dumpDate: z.string(),
  articleCount: z.number().int().min(0),
  entityCount: z.number().int().min(0),
  license: z.string().default('CC-BY-SA-4.0 / CC0-1.0'),
  checksum: z.string(),
});

export type GeneralKnowledgeSnapshot = z.infer<typeof generalKnowledgeSnapshotSchema>;
