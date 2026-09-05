/**
 * Developer Q&A Pack Types (CRK Phase 13: CRK-P13-T01 to T07)
 * Implements Stack Exchange / Stack Overflow ingestion, quality filtering,
 * chunking preserving Q&A relationship, and version signal extraction.
 */

export interface QAPair {
  id: string;
  site: string;
  externalId: string;
  questionTitle: string;
  questionBody: string;
  tags: string[];
  questionScore: number;
  answerId: string;
  answerBody: string;
  answerScore: number;
  isAccepted: boolean;
  author: string;
  creationDate: string;
  lastActivityDate: string;
  sourceUrl: string;
  license: string;
  inferredVersions?: Array<{
    product: string;
    version: string;
    confidence: number;
  }>;
}

export interface QAQualityFilterConfig {
  minQuestionScore: number;
  minAnswerScore: number;
  requireAcceptedOrScore: boolean;
  minBodyLength: number;
  rejectLinkOnly: boolean;
  rejectSpamPatterns: boolean;
}

export interface QAQualityFilterResult {
  accepted: boolean;
  reason?: string;
  qualityScore: number;
}

export interface QAChunk {
  chunkId: string;
  questionId: string;
  answerId: string;
  title: string;
  content: string;
  tags: string[];
  products: Array<{
    product: string;
    version?: string;
    confidence: number;
  }>;
  license: string;
  attribution: string;
  sourceUrl: string;
  authority: number;
  freshnessDate: string;
}

export interface QARefreshRecord {
  externalId: string;
  contentHash: string;
  lastIndexedAt: string;
  version: number;
}
