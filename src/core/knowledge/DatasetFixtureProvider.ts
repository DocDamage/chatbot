/**
 * Section 49: Dataset Fixture Provider
 * Provides zero-network mock knowledge retrieval and manifest verification for CI testing.
 */
import {
  DatasetFixtureCategory,
  DatasetFixtureChunk,
  DatasetFixtureManifest,
  FixtureQueryOptions,
  FixtureQueryResult
} from '../../types/dataset-fixtures';
import { CANONICAL_DATASET_FIXTURES } from './CanonicalDatasetFixtures';

export class DatasetFixtureProvider {
  private fixtures: Map<DatasetFixtureCategory, DatasetFixtureManifest>;

  constructor(customFixtures?: Record<DatasetFixtureCategory, DatasetFixtureManifest>) {
    this.fixtures = new Map(
      Object.entries(customFixtures || CANONICAL_DATASET_FIXTURES) as [DatasetFixtureCategory, DatasetFixtureManifest][]
    );
  }

  public getManifest(category: DatasetFixtureCategory): DatasetFixtureManifest | undefined {
    return this.fixtures.get(category);
  }

  public getAllManifests(): DatasetFixtureManifest[] {
    return Array.from(this.fixtures.values());
  }

  public verifyZeroNetworkGuarantee(): { compliant: boolean; totalChecked: number } {
    const manifests = this.getAllManifests();
    const allZeroNetwork = manifests.every((m) => m.zeroNetworkRequired === true);
    return {
      compliant: allZeroNetwork && manifests.length === 10,
      totalChecked: manifests.length
    };
  }

  public query(options: FixtureQueryOptions): FixtureQueryResult[] {
    const queryLower = options.query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);
    const results: FixtureQueryResult[] = [];

    const manifestsToSearch = options.category
      ? [this.fixtures.get(options.category)].filter(Boolean) as DatasetFixtureManifest[]
      : this.getAllManifests();

    for (const manifest of manifestsToSearch) {
      for (const chunk of manifest.chunks) {
        if (options.minAuthority && chunk.authority < options.minAuthority) {
          continue;
        }

        const contentLower = chunk.content.toLowerCase();
        const titleLower = chunk.title.toLowerCase();
        const matched = queryTokens.filter(
          (t) => contentLower.includes(t) || titleLower.includes(t)
        );

        if (matched.length > 0) {
          const matchRatio = matched.length / queryTokens.length;
          const score = matchRatio * 0.5 + chunk.authority * 0.5;
          results.push({
            chunk,
            score,
            matchedKeywords: matched
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return options.limit ? results.slice(0, options.limit) : results;
  }

  public resolveConflictingFactualClaims(topicQuery: string): DatasetFixtureChunk | undefined {
    const results = this.query({
      category: 'conflicting_sources',
      query: topicQuery
    });

    if (results.length === 0) return undefined;
    // Highest authority source wins arbitration
    return results[0].chunk;
  }

  public detectDuplicateChunks(): Array<{ original: DatasetFixtureChunk; duplicate: DatasetFixtureChunk }> {
    const manifest = this.getManifest('duplicate_data');
    if (!manifest || manifest.chunks.length < 2) return [];

    const seenContents = new Map<string, DatasetFixtureChunk>();
    const duplicates: Array<{ original: DatasetFixtureChunk; duplicate: DatasetFixtureChunk }> = [];

    for (const chunk of manifest.chunks) {
      const normalized = chunk.content.trim().toLowerCase();
      if (seenContents.has(normalized)) {
        duplicates.push({
          original: seenContents.get(normalized)!,
          duplicate: chunk
        });
      } else {
        seenContents.set(normalized, chunk);
      }
    }

    return duplicates;
  }
}
