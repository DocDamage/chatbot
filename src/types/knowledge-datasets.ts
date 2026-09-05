/**
 * Dataset Manifest Schemas and Types (CRK-P06-T01)
 *
 * Defines the schema for installable, versioned, governed dataset resources.
 */

import { z } from 'zod';

export const datasetSourceTypeSchema = z.enum([
  'official-docs',
  'developer-qa',
  'source-code',
  'encyclopedia',
  'structured-knowledge',
  'research',
  'math',
  'web',
  'custom',
]);

export type DatasetSourceType = z.infer<typeof datasetSourceTypeSchema>;

export const datasetLicenseSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  attributionRequired: z.boolean().optional().default(false),
  redistributable: z.union([z.boolean(), z.literal('unknown')]).optional().default(true),
});

export type DatasetLicense = z.infer<typeof datasetLicenseSchema>;

export const estimatedResourcesSchema = z.object({
  downloadBytes: z.number().int().nonnegative().optional(),
  indexedBytes: z.number().int().nonnegative().optional(),
  documents: z.number().int().nonnegative().optional(),
});

export type EstimatedResources = z.infer<typeof estimatedResourcesSchema>;

export const datasetManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-_]+$/, 'Dataset ID must be lowercase alphanumeric with hyphens/underscores'),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  provider: z.string().min(1),
  sourceType: datasetSourceTypeSchema,
  sourceUri: z.string().min(1),
  license: datasetLicenseSchema,
  authority: z.number().min(0).max(1).default(0.8),
  versionStrategy: z.enum(['release', 'date', 'commit', 'rolling']).default('release'),
  refreshPolicy: z.string().default('manual'),
  defaultEnabled: z.boolean().default(false),
  installPolicy: z.enum(['bundled', 'download', 'stream-filter', 'api-sync']).default('download'),
  languages: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  estimatedResources: estimatedResourcesSchema.optional(),
});

export type DatasetManifest = z.infer<typeof datasetManifestSchema>;

export const datasetVersionRecordSchema = z.object({
  id: z.string().min(1),
  datasetId: z.string().min(1),
  version: z.string().min(1),
  releasedAt: z.string().optional(),
  discoveredAt: z.string().optional().default(() => new Date().toISOString()),
  installedAt: z.string().optional(),
  documentCount: z.number().int().nonnegative().default(0),
  chunkCount: z.number().int().nonnegative().default(0),
  byteSize: z.number().int().nonnegative().default(0),
  contentHash: z.string().optional(),
  status: z.enum(['available', 'downloading', 'indexing', 'installed', 'failed', 'removed']).default('available'),
  metadata: z.record(z.unknown()).optional(),
});

export type DatasetVersionRecord = z.infer<typeof datasetVersionRecordSchema>;

export const datasetJobSchema = z.object({
  id: z.string().min(1),
  datasetId: z.string().min(1),
  datasetVersionId: z.string().optional(),
  jobType: z.enum(['install', 'update', 'remove', 'verify']),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  progressCurrent: z.number().nonnegative().default(0),
  progressTotal: z.number().nonnegative().default(100),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type DatasetJob = z.infer<typeof datasetJobSchema>;
