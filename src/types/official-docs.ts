/**
 * Official Documentation Pack Schemas and Types (CRK-P07-T01, T02, T04, T05)
 *
 * Defines the schemas for official technical documentation sources, manifests,
 * semantic chunks, and version compatibility indexing.
 */

import { z } from 'zod';

export const SUPPORTED_DOC_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'c',
  'cpp',
  'csharp',
  'rust',
  'go',
  'java',
  'lua',
  'sql',
  'html',
  'css',
  'powershell',
  'bash',
  'gdscript',
] as const;

export const SUPPORTED_DOC_FRAMEWORKS = [
  'nodejs',
  'react',
  'vite',
  'svelte',
  'tailwindcss',
  'godot',
  'git',
  'github',
  'github-actions',
  'docker',
  'postgresql',
  'sqlite',
  'npm',
  'cmake',
  'dotnet',
  'cargo',
  'go-tooling',
] as const;

export const docIngestionStrategySchema = z.enum([
  'static-download',
  'repository-docs',
  'api-export',
  'controlled-web',
  'snapshot',
]);

export type DocIngestionStrategy = z.infer<typeof docIngestionStrategySchema>;

export const officialDocManifestSchema = z.object({
  dataset: z.literal('official-docs').default('official-docs'),
  product: z.string().min(1),
  version: z.string().min(1),
  authority: z.number().min(0).max(1).default(0.95),
  sourceType: z.literal('official-documentation').default('official-documentation'),
  sourceUrl: z.string().min(1),
  retrievedAt: z.string().default(() => new Date().toISOString()),
  language: z.string().default('en'),
  contentHash: z.string().min(1),
  ingestionStrategy: docIngestionStrategySchema.default('repository-docs'),
  metadata: z.record(z.unknown()).optional(),
});

export type OfficialDocManifest = z.infer<typeof officialDocManifestSchema>;
export type OfficialDocManifestInput = z.input<typeof officialDocManifestSchema>;

export const officialDocChunkSchema = z.object({
  id: z.string().min(1),
  product: z.string().min(1),
  version: z.string().min(1),
  page: z.string().min(1),
  headingHierarchy: z.array(z.string()).default([]),
  subsection: z.string().default(''),
  content: z.string().min(1),
  codeExamples: z.array(z.string()).default([]),
  apiSymbols: z.array(z.string()).default([]),
  anchors: z.array(z.string()).default([]),
  deprecationNotes: z.array(z.string()).default([]),
  tokenCount: z.number().int().nonnegative().default(0),
});

export type OfficialDocChunk = z.infer<typeof officialDocChunkSchema>;

export const versionIndexRecordSchema = z.object({
  product: z.string().min(1),
  versionString: z.string().min(1),
  majorVersion: z.number().int().nonnegative(),
  minorVersion: z.number().int().nonnegative(),
  patchVersion: z.number().int().nonnegative().optional(),
  versionRange: z.string().optional(),
  deprecated: z.boolean().default(false),
  introducedIn: z.string().optional(),
  removedIn: z.string().optional(),
  isLts: z.boolean().optional().default(false),
});

export type VersionIndexRecord = z.infer<typeof versionIndexRecordSchema>;
export type VersionIndexRecordInput = z.input<typeof versionIndexRecordSchema>;

