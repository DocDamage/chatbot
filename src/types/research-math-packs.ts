/**
 * Research and Math Packs Schemas & Interfaces (CRK Phase 20: CRK-P20-T01 to T06)
 *
 * Defines schemas for scholarly research papers, academic license policies,
 * structural research chunks, and mathematical theorem/proof/LaTeX chunks.
 */

import { z } from 'zod';

export const academicLicenseSchema = z.enum([
  'CC-BY-4.0',
  'CC-BY-3.0',
  'CC-BY-SA-4.0',
  'CC0-1.0',
  'arXiv-non-exclusive',
  'OpenAccess-Permissive',
  'proprietary-closed',
  'unknown',
]);

export type AcademicLicense = z.infer<typeof academicLicenseSchema>;

export const researchSectionTypeSchema = z.enum([
  'title',
  'abstract',
  'introduction',
  'methodology',
  'results',
  'discussion',
  'conclusion',
  'figures_tables',
  'references_bibliography',
]);

export type ResearchSectionType = z.infer<typeof researchSectionTypeSchema>;

export const researchChunkSchema = z.object({
  chunkId: z.string().min(1),
  paperId: z.string().min(1),
  doi: z.string().optional(),
  arxivId: z.string().optional(),
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  year: z.number().int().min(1900).max(2100),
  venue: z.string().optional(),
  field: z.string().default('computer_science'),
  sectionType: researchSectionTypeSchema,
  sectionTitle: z.string(),
  content: z.string().min(1),
  sourceUrl: z.string().url(),
  license: academicLicenseSchema,
  isRetracted: z.boolean().default(false),
  hasErrata: z.boolean().default(false),
  authority: z.number().min(0).max(1).default(0.88),
  publishedDate: z.string(),
});

export type ResearchChunk = z.infer<typeof researchChunkSchema>;

export const researchPaperSchema = z.object({
  paperId: z.string().min(1),
  doi: z.string().optional(),
  arxivId: z.string().optional(),
  title: z.string().min(1),
  authors: z.array(z.string()).min(1),
  year: z.number().int().min(1900).max(2100),
  venue: z.string().optional(),
  field: z.string().default('computer_science'),
  abstract: z.string().min(1),
  sections: z.array(researchChunkSchema).default([]),
  sourceUrl: z.string().url(),
  license: academicLicenseSchema,
  isRetracted: z.boolean().default(false),
  hasErrata: z.boolean().default(false),
  retractionReason: z.string().optional(),
  publishedDate: z.string(),
});

export type ResearchPaper = z.infer<typeof researchPaperSchema>;

export const mathChunkTypeSchema = z.enum([
  'definition',
  'theorem',
  'lemma',
  'corollary',
  'proof',
  'derivation',
  'formula',
  'example',
]);

export type MathChunkType = z.infer<typeof mathChunkTypeSchema>;

export const mathTheoremChunkSchema = z.object({
  chunkId: z.string().min(1),
  docId: z.string().min(1),
  title: z.string().min(1),
  chunkType: mathChunkTypeSchema,
  identifier: z.string().optional(), // e.g. "Theorem 3.1" or "Definition 1.2"
  statement: z.string().min(1),
  proofOrDerivation: z.string().optional(),
  latexEquations: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]), // IDs of referenced lemmas/theorems
  domain: z.string().default('pure_math'), // calculus, algebra, topology, etc.
  sourceUrl: z.string().url().optional(),
  license: z.string().default('CC-BY-SA-4.0'),
  authority: z.number().min(0).max(1).default(0.88),
});

export type MathTheoremChunk = z.infer<typeof mathTheoremChunkSchema>;

export const mathDocumentSchema = z.object({
  docId: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  domain: z.string().default('mathematics'),
  chunks: z.array(mathTheoremChunkSchema).default([]),
  license: z.string().default('CC-BY-SA-4.0'),
  sourceUrl: z.string().url().optional(),
});

export type MathDocument = z.infer<typeof mathDocumentSchema>;
