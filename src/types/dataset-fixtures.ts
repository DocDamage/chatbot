/**
 * Section 49: Dataset Fixtures Strategy Specification & Types
 */
import { z } from 'zod';

export const DatasetFixtureCategorySchema = z.enum([
  'official_docs',
  'qa',
  'code',
  'encyclopedia',
  'research',
  'math',
  'prompt_injection',
  'duplicate_data',
  'outdated_version',
  'conflicting_sources'
]);
export type DatasetFixtureCategory = z.infer<typeof DatasetFixtureCategorySchema>;

export interface DatasetFixtureChunk {
  id: string;
  sourceUri: string;
  title: string;
  content: string;
  authority: number;
  license: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface DatasetFixtureManifest {
  category: DatasetFixtureCategory;
  name: string;
  description: string;
  legalStatus: 'CLEARED_OPEN_SOURCE' | 'SYNTHETIC_TEST_DATA';
  zeroNetworkRequired: boolean;
  chunks: DatasetFixtureChunk[];
  hash: string;
}

export interface FixtureQueryOptions {
  category?: DatasetFixtureCategory;
  query: string;
  limit?: number;
  minAuthority?: number;
}

export interface FixtureQueryResult {
  chunk: DatasetFixtureChunk;
  score: number;
  matchedKeywords: string[];
}
