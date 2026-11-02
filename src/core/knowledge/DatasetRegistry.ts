/**
 * Dataset Registry (CRK-P06-T04)
 *
 * Manages source-controlled dataset manifests, schema validation, deduplication,
 * license auditing, and metadata inspection without performing automatic downloads.
 */

import { DatasetManifest, datasetManifestSchema } from '../../types/knowledge-datasets';

export interface RegisteredDatasetEntry {
  manifest: DatasetManifest;
  isLicenseRecognized: boolean;
  requiresAttribution: boolean;
  isRedistributable: boolean | 'unknown';
  registeredAt: string;
}

export class DatasetRegistry {
  private readonly manifests = new Map<string, RegisteredDatasetEntry>();
  private readonly slugIndex = new Map<string, string>();

  /**
   * Register a dataset manifest with schema validation and duplicate rejection.
   */
  public register(manifestInput: unknown): RegisteredDatasetEntry {
    const parsed = datasetManifestSchema.safeParse(manifestInput);
    if (!parsed.success) {
      throw new Error(`Dataset manifest schema validation failed: ${parsed.error.message}`);
    }

    const manifest = parsed.data;

    // Check duplicate ID (§1526)
    if (this.manifests.has(manifest.id)) {
      throw new Error(`Dataset with ID '${manifest.id}' is already registered`);
    }

    // Check duplicate slug
    if (this.slugIndex.has(manifest.slug)) {
      throw new Error(`Dataset with slug '${manifest.slug}' is already registered by ID '${this.slugIndex.get(manifest.slug)}'`);
    }

    // License auditing (§1527)
    const recognizedLicenses = [
      'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'ISC', 'Unlicense'
    ];
    const isLicenseRecognized = recognizedLicenses.includes(manifest.license.id);

    const entry: RegisteredDatasetEntry = {
      manifest,
      isLicenseRecognized,
      requiresAttribution: manifest.license.attributionRequired,
      isRedistributable: manifest.license.redistributable,
      registeredAt: new Date().toISOString(),
    };

    this.manifests.set(manifest.id, entry);
    this.slugIndex.set(manifest.slug, manifest.id);

    return entry;
  }

  /**
   * Register multiple manifests in batch.
   */
  public registerBatch(manifests: unknown[]): RegisteredDatasetEntry[] {
    return manifests.map(m => this.register(m));
  }

  public get(id: string): RegisteredDatasetEntry | undefined {
    return this.manifests.get(id);
  }

  public getBySlug(slug: string): RegisteredDatasetEntry | undefined {
    const id = this.slugIndex.get(slug);
    return id ? this.manifests.get(id) : undefined;
  }

  public list(): RegisteredDatasetEntry[] {
    return Array.from(this.manifests.values());
  }

  public listBySourceType(sourceType: DatasetManifest['sourceType']): RegisteredDatasetEntry[] {
    return this.list().filter(e => e.manifest.sourceType === sourceType);
  }

  public listByLanguage(language: string): RegisteredDatasetEntry[] {
    return this.list().filter(e => e.manifest.languages?.includes(language.toLowerCase()));
  }

  public count(): number {
    return this.manifests.size;
  }

  public clear(): void {
    this.manifests.clear();
    this.slugIndex.clear();
  }
}
