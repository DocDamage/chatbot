/**
 * Knowledge Pack Schemas and Definitions (CRK-P06-T02)
 *
 * Defines the schema and initial catalog for Knowledge Packs, which are
 * user/product-level groupings of one or more datasets with precedence routing.
 */

import { z } from 'zod';

export const knowledgePackCategorySchema = z.enum([
  'coding',
  'general',
  'research',
  'math',
  'multilingual',
  'custom',
]);

export type KnowledgePackCategory = z.infer<typeof knowledgePackCategorySchema>;

export const knowledgePackSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-_]+$/, 'Pack ID must be lowercase alphanumeric with hyphens/underscores'),
  name: z.string().min(1),
  description: z.string().default(''),
  category: knowledgePackCategorySchema,
  datasetIds: z.array(z.string()).default([]),
  defaultRoutingDomains: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  precedence: z.number().int().min(1).default(100),
});

export type KnowledgePack = z.infer<typeof knowledgePackSchema>;

export const INITIAL_KNOWLEDGE_PACKS: KnowledgePack[] = [
  {
    id: 'core-official-docs',
    name: 'Official Documentation',
    description: 'High-authority official handbooks, API references, and manuals for major languages and frameworks.',
    category: 'coding',
    datasetIds: ['official-docs-core'],
    defaultRoutingDomains: ['typescript', 'javascript', 'python', 'rust', 'csharp', 'godot'],
    enabled: true,
    precedence: 10,
  },
  {
    id: 'developer-qa',
    name: 'Curated Developer Q&A',
    description: 'Verified solutions and expert discussions for common errors and edge cases.',
    category: 'coding',
    datasetIds: ['stackoverflow-curated'],
    defaultRoutingDomains: ['debugging', 'error-resolutions'],
    enabled: true,
    precedence: 20,
  },
  {
    id: 'curated-code',
    name: 'Curated Code Examples',
    description: 'High-quality, idiomatic open-source code repositories and patterns.',
    category: 'coding',
    datasetIds: ['curated-code-snippets'],
    defaultRoutingDomains: ['code-examples', 'design-patterns'],
    enabled: true,
    precedence: 30,
  },
  {
    id: 'general-knowledge',
    name: 'General Knowledge',
    description: 'Encyclopedic and reference knowledge for science, history, geography, and concepts.',
    category: 'general',
    datasetIds: ['encyclopedia-core'],
    defaultRoutingDomains: ['general-knowledge', 'concepts'],
    enabled: true,
    precedence: 40,
  },
  {
    id: 'research',
    name: 'Scientific & Academic Research',
    description: 'Peer-reviewed papers, preprints, and scientific summaries.',
    category: 'research',
    datasetIds: ['arxiv-summaries'],
    defaultRoutingDomains: ['research', 'scientific-papers'],
    enabled: true,
    precedence: 50,
  },
  {
    id: 'math',
    name: 'Mathematics & Formal Proofs',
    description: 'Mathematical theorems, definitions, derivations, and formulas.',
    category: 'math',
    datasetIds: ['math-proofs-theorems'],
    defaultRoutingDomains: ['math', 'calculus', 'algebra', 'proofs'],
    enabled: true,
    precedence: 50,
  },
  {
    id: 'educational-web',
    name: 'Educational Web Content',
    description: 'Structured tutorials, course notes, and educational guides.',
    category: 'general',
    datasetIds: ['educational-guides'],
    defaultRoutingDomains: ['tutorials', 'how-to'],
    enabled: true,
    precedence: 60,
  },
  {
    id: 'multilingual',
    name: 'Multilingual Knowledge',
    description: 'Cross-lingual datasets, terminology glossaries, and international docs.',
    category: 'multilingual',
    datasetIds: ['multilingual-glossaries'],
    defaultRoutingDomains: ['translations', 'multilingual'],
    enabled: true,
    precedence: 70,
  },
];
