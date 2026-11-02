/**
 * General Knowledge Retrieval Policy Types and Schemas (Section 51)
 *
 * Implements policy boundaries for general knowledge queries:
 * - §51.1 Normal facts (structured knowledge, encyclopedia, authoritative domain)
 * - §51.2 Scientific questions (research/reviews, structured metadata, encyclopedia)
 * - §51.3 Time-sensitive facts (staleness detection, live route fallback)
 * - §51.4 No false freshness invariant (disclosure on static snapshots)
 */

export type GeneralQueryCategory = 'normal_fact' | 'scientific_question' | 'time_sensitive_fact';

export type GeneralSourceTier =
  | 'structured_knowledge'
  | 'encyclopedia'
  | 'authoritative_domain'
  | 'research_papers'
  | 'live_web'
  | 'broader_sources';

export interface SnapshotMetadata {
  snapshotId: string;
  snapshotDate: string; // ISO date string e.g. "2024-01-01"
  cutoffDate: string;   // ISO date string e.g. "2023-12-31"
  version: string;
}

export interface GeneralRetrievalPolicyConfig {
  allowOnlineRetrieval: boolean;
  timeSensitivityKeywords?: string[];
  scientificKeywords?: string[];
  maxStalenessDaysBeforeWarning: number; // default e.g. 180 days
}

export interface TemporalAnalysisResult {
  isTimeSensitive: boolean;
  temporalIndicators: string[];
  requestedYear?: number;
}

export interface GeneralRetrievalPlan {
  query: string;
  category: GeneralQueryCategory;
  preferredSourceOrder: GeneralSourceTier[];
  temporalAnalysis: TemporalAnalysisResult;
  onlineRetrievalRecommended: boolean;
  freshnessDisclosureRequired: boolean;
  disclosureMessage?: string;
  evaluatedAt: string;
}
