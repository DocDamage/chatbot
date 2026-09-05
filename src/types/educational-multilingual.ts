/**
 * Educational Web and Multilingual Packs Schemas (CRK-P21-T01, T02, T04, T05)
 *
 * Provides schemas for quality-filtered educational web documents, topic classifications,
 * language-specific partitions, and embedding model compatibility tracking.
 */

import { z } from 'zod';

export const educationalTopicSchema = z.enum([
  'software',
  'science',
  'engineering',
  'history',
  'general_education',
]);

export type EducationalTopic = z.infer<typeof educationalTopicSchema>;

export const supportedLanguageCodeSchema = z.enum([
  'en',
  'es',
  'fr',
  'de',
  'pt',
  'ja',
  'zh',
  'it',
]);

export type SupportedLanguageCode = z.infer<typeof supportedLanguageCodeSchema>;

export const educationalQualityScoreSchema = z.object({
  score: z.number().min(0).max(1),
  educationalValue: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  structureScore: z.number().min(0).max(1),
  rejectionReason: z.string().optional(),
});

export type EducationalQualityScore = z.infer<typeof educationalQualityScoreSchema>;

export const educationalDocumentSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  topic: educationalTopicSchema,
  language: supportedLanguageCodeSchema.default('en'),
  qualityScore: educationalQualityScoreSchema,
  license: z.string().default('Open-Web-Curated'),
  extractedDate: z.string(),
  contentHash: z.string(),
});

export type EducationalDocument = z.infer<typeof educationalDocumentSchema>;

export const multilingualDocumentSchema = z.object({
  id: z.string().min(1),
  language: supportedLanguageCodeSchema,
  sourceUrl: z.string().url().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  domain: z.string().min(1),
  nativeGlossaryTerms: z.array(z.string()).default([]),
  license: z.string().default('CC-BY-4.0'),
});

export type MultilingualDocument = z.infer<typeof multilingualDocumentSchema>;

export const embeddingCompatibilitySchema = z.object({
  packId: z.string().min(1),
  language: supportedLanguageCodeSchema,
  modelName: z.string().min(1),
  dimension: z.number().int().positive(),
  modelVersion: z.string().min(1),
  isMultilingual: z.boolean(),
  migrationRequired: z.boolean().default(false),
});

export type EmbeddingCompatibility = z.infer<typeof embeddingCompatibilitySchema>;
