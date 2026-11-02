import { describe, it, expect } from '@jest/globals';
import {
  datasetManifestSchema,
  datasetJobSchema,
  DatasetManifest,
} from './knowledge-datasets';

describe('Dataset Manifest Schemas (CRK-P06-T01)', () => {
  it('validates a complete official-docs dataset manifest', () => {
    const manifest: DatasetManifest = {
      id: 'typescript-official-docs',
      slug: 'typescript-official-docs',
      name: 'TypeScript Official Documentation',
      description: 'Handbook, reference, and release notes for TypeScript',
      provider: 'Microsoft',
      sourceType: 'official-docs',
      sourceUri: 'https://www.typescriptlang.org/docs/',
      license: {
        id: 'Apache-2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0',
        attributionRequired: true,
        redistributable: true,
      },
      authority: 0.98,
      versionStrategy: 'release',
      refreshPolicy: 'monthly',
      defaultEnabled: true,
      installPolicy: 'download',
      languages: ['typescript'],
      tags: ['docs', 'types', 'javascript'],
      estimatedResources: {
        downloadBytes: 15_000_000,
        indexedBytes: 45_000_000,
        documents: 350,
      },
    };

    const parsed = datasetManifestSchema.safeParse(manifest);
    expect(parsed.success).toBe(true);
  });

  it('rejects manifest with invalid ID characters', () => {
    const invalidManifest = {
      id: 'TypeScript Docs With Spaces!',
      slug: 'typescript-docs',
      name: 'TypeScript',
      provider: 'Microsoft',
      sourceType: 'official-docs',
      sourceUri: 'https://typescriptlang.org',
      license: { id: 'MIT' },
    };

    const parsed = datasetManifestSchema.safeParse(invalidManifest);
    expect(parsed.success).toBe(false);
  });

  it('validates a dataset job tracking progress and status', () => {
    const job = {
      id: 'job-9876',
      datasetId: 'typescript-official-docs',
      jobType: 'install' as const,
      status: 'running' as const,
      progressCurrent: 45,
      progressTotal: 100,
    };

    const parsed = datasetJobSchema.safeParse(job);
    expect(parsed.success).toBe(true);
  });
});
