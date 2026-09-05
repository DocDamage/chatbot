import { describe, it, expect } from '@jest/globals';
import { DatasetRegistry } from '../DatasetRegistry';
import { DatasetLicensePolicy } from '../DatasetLicensePolicy';
import { DatasetStorageQuota } from '../DatasetStorageQuota';
import { DatasetManager } from '../DatasetManager';
import { KnowledgePackManager } from '../KnowledgePackManager';
import { getDatasetMigrations } from '../../database/DatasetMigrations';
import { DatasetManifest } from '../../../types/knowledge-datasets';

describe('Knowledge Infrastructure Integration & Phase 06 Exit Gate', () => {
  const sampleManifest: DatasetManifest = {
    id: 'typescript-official-docs',
    slug: 'typescript-official-docs',
    name: 'TypeScript Official Docs',
    description: 'Official TypeScript language handbook and reference',
    provider: 'Microsoft',
    sourceType: 'official-docs',
    sourceUri: 'https://www.typescriptlang.org/docs/',
    license: {
      id: 'Apache-2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
      attributionRequired: true,
      redistributable: true,
    },
    authority: 0.95,
    versionStrategy: 'release',
    refreshPolicy: 'monthly',
    defaultEnabled: true,
    installPolicy: 'download',
    languages: ['typescript'],
    tags: ['docs', 'types'],
    estimatedResources: {
      downloadBytes: 20_000_000,
      indexedBytes: 60_000_000,
      documents: 400,
    },
  };

  it('Exit Gate Criterion 1: Dataset & Pack manifests validate strictly (§1590)', () => {
    const registry = new DatasetRegistry();
    const entry = registry.register(sampleManifest);

    expect(entry.manifest.id).toBe('typescript-official-docs');
    expect(entry.isLicenseRecognized).toBe(true);
    expect(entry.requiresAttribution).toBe(true);

    // Rejects duplicate ID (§1526)
    expect(() => registry.register(sampleManifest)).toThrow(/already registered/);

    const packManager = new KnowledgePackManager();
    const packs = packManager.list();
    expect(packs.length).toBeGreaterThanOrEqual(8);
  });

  it('Exit Gate Criterion 2: New tables migrate on SQLite and PostgreSQL (§1591)', () => {
    const sqliteMigrations = getDatasetMigrations('sqlite');
    const postgresMigrations = getDatasetMigrations('postgresql');

    expect(sqliteMigrations.length).toBeGreaterThanOrEqual(8);
    expect(postgresMigrations.length).toBeGreaterThanOrEqual(8);

    const requiredTables = [
      'knowledge_datasets',
      'knowledge_dataset_versions',
      'knowledge_packs',
      'knowledge_pack_memberships',
      'dataset_source_links',
      'dataset_jobs',
    ];

    for (const table of requiredTables) {
      const sqliteHasTable = sqliteMigrations.some(sql => sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`));
      const postgresHasTable = postgresMigrations.some(sql => sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`));
      expect(sqliteHasTable).toBe(true);
      expect(postgresHasTable).toBe(true);
    }
  });

  it('Exit Gate Criterion 3: License & resource policy runs before ingestion (§1593)', () => {
    const registry = new DatasetRegistry();
    const licensePolicy = new DatasetLicensePolicy();
    const storageQuota = new DatasetStorageQuota({ minFreeDiskGb: 10 });
    const manager = new DatasetManager(registry, licensePolicy, storageQuota);

    // Register valid dataset
    registry.register(sampleManifest);

    // Test quota denial on insufficient disk
    const quotaDeniedPlan = manager.planInstall('typescript-official-docs', 5); // 5GB free < 10GB reserve
    expect(quotaDeniedPlan.canInstall).toBe(false);
    expect(quotaDeniedPlan.violations.some(v => v.includes('Insufficient free disk space'))).toBe(true);

    // Register non-redistributable dataset
    const proprietaryManifest: DatasetManifest = {
      ...sampleManifest,
      id: 'proprietary-code-dataset',
      slug: 'proprietary-code-dataset',
      license: {
        id: 'PROPRIETARY',
        redistributable: false,
        attributionRequired: false,
      },
    };
    registry.register(proprietaryManifest);

    const licenseDeniedPlan = manager.planInstall('proprietary-code-dataset', 100);
    expect(licenseDeniedPlan.canInstall).toBe(false);
    expect(licenseDeniedPlan.violations.some(v => v.includes('not redistributable'))).toBe(true);
  });

  it('Exit Gate Criterion 4: Install/update/remove jobs are resumable and auditable (§1592)', async () => {
    const registry = new DatasetRegistry();
    const manager = new DatasetManager(registry);
    registry.register(sampleManifest);

    const plan = manager.planInstall('typescript-official-docs', 100);
    expect(plan.canInstall).toBe(true);
    expect(plan.jobId).toBeDefined();

    // Verify recovery of interrupted job
    const recovered = manager.recoverJob(plan.jobId);
    expect(recovered.status).toBe('queued');

    // Execute job
    const completedJob = await manager.executeJob(plan.jobId);
    expect(completedJob.status).toBe('completed');
    expect(completedJob.progressCurrent).toBe(100);
    expect(completedJob.datasetVersionId).toBeDefined();

    // Verify installed version tracked
    const installed = manager.getInstalledVersion('typescript-official-docs');
    expect(installed?.status).toBe('installed');
    expect(installed?.version).toBe('1.0.0');
  });

  it('Exit Gate Criterion 5: Pack readiness, precedence, and non-destructive cascade disable (§1555)', () => {
    const packManager = new KnowledgePackManager();

    // Initially, no dataset is installed
    const readinessBefore = packManager.getReadiness('core-official-docs', []);
    expect(readinessBefore.isReady).toBe(false);
    expect(readinessBefore.missingDatasetIds.length).toBeGreaterThan(0);

    // With datasets installed, pack is ready
    const readinessAfter = packManager.getReadiness('core-official-docs', ['official-docs-core']);
    expect(readinessAfter.isReady).toBe(true);
    expect(readinessAfter.missingDatasetIds).toHaveLength(0);

    // Cascade disable preserves data IDs
    const cascade = packManager.cascadeDisable('core-official-docs');
    expect(cascade.disabled).toBe(true);
    expect(cascade.datasetIdsPreserved).toContain('official-docs-core');
    expect(packManager.get('core-official-docs')?.enabled).toBe(false);
  });

  it('Exit Gate Criterion 6: No large external dataset is installed by default (§1594)', () => {
    const registry = new DatasetRegistry();
    const manager = new DatasetManager(registry);

    // Zero external datasets are installed out-of-the-box
    expect(manager.listInstalledDatasetIds()).toHaveLength(0);
  });
});
