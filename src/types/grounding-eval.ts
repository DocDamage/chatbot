/**
 * Grounding, Evidence Sufficiency, and Abstention Schemas
 * CRK Phase 12: CRK-P12-T01, T02, T05
 */

export type RecommendedAction =
  | 'answer'
  | 'broaden-local'
  | 'search-online'
  | 'ask-clarification'
  | 'abstain';

export interface RetrievalConfidenceFeatures {
  topScore: number;
  scoreMargin: number;
  sourceAuthority: number;
  sourceDiversity: number;
  versionCompatibility: number;
  relevantChunkCount: number;
  queryCoverage: number;
  conflictingEvidence: boolean;
}

export interface GroundingDecision {
  attempted: boolean;
  sufficient: boolean;
  confidence: number;
  reasons: string[];
  recommendedAction: RecommendedAction;
  features?: RetrievalConfidenceFeatures;
}

export type AbstentionDistinction =
  | 'insufficient-local-knowledge'
  | 'fact-nonexistent'
  | 'conflict';

export interface AbstentionResponse {
  userMessage: string;
  missingInfoDescription: string;
  suggestedAction?: string;
  distinction: AbstentionDistinction;
  decision: GroundingDecision;
}

export interface EvidenceChunk {
  id: string;
  content: string;
  sourceUri: string;
  authority: number;
  compositeScore: number;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface GroundingEvaluationInput {
  query: string;
  chunks: EvidenceChunk[];
  onlineSearchAllowed?: boolean;
  localScopeBroadened?: boolean;
  strictThreshold?: number;
}
