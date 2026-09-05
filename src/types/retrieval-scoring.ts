import { z } from 'zod';

/**
 * Baseline source authority classification (§1875-1890)
 */
export enum SourceAuthorityTier {
  USER_CANONICAL = 'user_canonical',       // 1.00
  REPO_EVIDENCE = 'repo_evidence',         // 0.98
  OFFICIAL_SPEC = 'official_spec',         // 0.97
  OFFICIAL_DOCS = 'official_docs',         // 0.95
  REPUTABLE_RESEARCH = 'reputable_research', // 0.88
  VETTED_REFERENCE = 'vetted_reference',   // 0.84
  ACCEPTED_DEV_QA = 'accepted_dev_qa',     // 0.78
  CURATED_CODE = 'curated_code',           // 0.74
  ENCYCLOPEDIA = 'encyclopedia',           // 0.67
  EDUCATIONAL_WEB = 'educational_web',     // 0.58
  GENERAL_WEB = 'general_web'              // 0.42
}

export const BASE_AUTHORITY_WEIGHTS: Record<SourceAuthorityTier, number> = {
  [SourceAuthorityTier.USER_CANONICAL]: 1.00,
  [SourceAuthorityTier.REPO_EVIDENCE]: 0.98,
  [SourceAuthorityTier.OFFICIAL_SPEC]: 0.97,
  [SourceAuthorityTier.OFFICIAL_DOCS]: 0.95,
  [SourceAuthorityTier.REPUTABLE_RESEARCH]: 0.88,
  [SourceAuthorityTier.VETTED_REFERENCE]: 0.84,
  [SourceAuthorityTier.ACCEPTED_DEV_QA]: 0.78,
  [SourceAuthorityTier.CURATED_CODE]: 0.74,
  [SourceAuthorityTier.ENCYCLOPEDIA]: 0.67,
  [SourceAuthorityTier.EDUCATIONAL_WEB]: 0.58,
  [SourceAuthorityTier.GENERAL_WEB]: 0.42
};

export enum VersionCompatibilityStatus {
  EXACT = 'exact',                                     // 1.00
  SAME_MAJOR_COMPATIBLE_MINOR = 'same_major_compat',   // 0.90
  SAME_MAJOR_UNKNOWN_MINOR = 'same_major_unknown',     // 0.75
  OLDER_MAJOR = 'older_major',                         // 0.25
  KNOWN_INCOMPATIBLE = 'known_incompatible',           // 0.00
  UNKNOWN = 'unknown'                                  // 0.55
}

export const VERSION_COMPATIBILITY_SCORES: Record<VersionCompatibilityStatus, number> = {
  [VersionCompatibilityStatus.EXACT]: 1.00,
  [VersionCompatibilityStatus.SAME_MAJOR_COMPATIBLE_MINOR]: 0.90,
  [VersionCompatibilityStatus.SAME_MAJOR_UNKNOWN_MINOR]: 0.75,
  [VersionCompatibilityStatus.OLDER_MAJOR]: 0.25,
  [VersionCompatibilityStatus.KNOWN_INCOMPATIBLE]: 0.00,
  [VersionCompatibilityStatus.UNKNOWN]: 0.55
};

export interface VersionContext {
  product?: string;
  requested?: string;
  projectDetected?: string;
  sourceVersion?: string;
}

export interface QualitySignals {
  isAcceptedAnswer?: boolean;
  score?: number;
  isOfficialStatus?: boolean;
  contentCompleteness?: number; // 0.0 - 1.0
  spamScore?: number;           // 0.0 - 1.0
  isMinifiedOrGenerated?: boolean;
}

export interface RetrievalPolicyWeights {
  semanticSimilarity: number;
  lexicalScore: number;
  rerankerScore: number;
  authorityScore: number;
  versionScore: number;
  freshnessScore: number;
  qualityScore: number;
}

export const DEFAULT_RETRIEVAL_POLICY_WEIGHTS: RetrievalPolicyWeights = {
  semanticSimilarity: 0.28,
  lexicalScore: 0.14,
  rerankerScore: 0.20,
  authorityScore: 0.16,
  versionScore: 0.10,
  freshnessScore: 0.07,
  qualityScore: 0.05
};

export interface RetrievalPolicy {
  version: string;
  id: string;
  name: string;
  weights: RetrievalPolicyWeights;
  domainHalfLifeDays: Record<string, number>;
  authorityWeights: Record<SourceAuthorityTier, number>;
}

export interface RetrievalScoreBreakdown {
  semanticSimilarity: number;
  lexicalScore: number;
  rerankerScore: number;
  authorityScore: number;
  versionScore: number;
  freshnessScore: number;
  qualityScore: number;
  finalScore: number;
}

export interface CandidateEvidence {
  id: string;
  content: string;
  sourceUri: string;
  authorityTier: SourceAuthorityTier;
  versionContext?: VersionContext;
  publishedAt?: string | Date;
  domain?: string;
  qualitySignals?: QualitySignals;
  rawSimilarity?: number;
  rawLexical?: number;
  rawReranker?: number;
}

export interface ScoredEvidence extends CandidateEvidence {
  breakdown: RetrievalScoreBreakdown;
  versionStatus: VersionCompatibilityStatus;
}

export interface ConflictRecord {
  topic: string;
  preferredSourceUri: string;
  supersededSourceUri: string;
  preferredVersion?: string;
  supersededVersion?: string;
  reason: 'version_match' | 'higher_authority' | 'greater_freshness' | 'quality_gap';
  materialUncertainty: boolean;
  explanation: string;
}

export const RetrievalPolicyWeightsSchema = z.object({
  semanticSimilarity: z.number().min(0).max(1),
  lexicalScore: z.number().min(0).max(1),
  rerankerScore: z.number().min(0).max(1),
  authorityScore: z.number().min(0).max(1),
  versionScore: z.number().min(0).max(1),
  freshnessScore: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1)
});
