/**
 * Training and Fine-Tuning Separation Schemas and Types (Section 53)
 *
 * Enforces strict boundaries between RAG source evidence, reviewed instruction/training examples,
 * and held-out evaluation test suites (§53.1-§53.3), and manages fine-tuning readiness governance (§53.4).
 */

export type DataCorpusDomain = 'rag' | 'training' | 'evaluation';

export type FineTuningStatus =
  | 'DISABLED'
  | 'LOCAL_ONLY_EXPERIMENTAL'
  | 'PRODUCTION_PREVIEW'
  | 'PRODUCTION_SUPPORTED';

export interface CorpusEntry {
  id: string;
  domain: DataCorpusDomain;
  contentHash: string; // SHA-256 normalized hash
  description: string;
  sourceUri?: string;
  license?: string;
  itemCount: number;
  addedAt: string;
}

export interface ContaminationAuditResult {
  hasContamination: boolean;
  evaluationOverlapsWithTraining: string[]; // List of hashes or IDs
  evaluationOverlapsWithRag: string[];      // List of hashes or IDs
  trainingOverlapsWithRag: string[];
  totalEvaluationItems: number;
  checkedAt: string;
}

export interface FineTuningPrerequisites {
  trainingTargetSelected: boolean;
  targetDetails?: string;
  licenseAndPrivacyReviewed: boolean;
  evaluationsProveMeasurableBenefit: boolean;
  benefitMetricsSummary?: string;
  rollbackAndVersionPolicyConfigured: boolean;
}

export interface FineTuningGovernanceAssessment {
  currentStatus: FineTuningStatus;
  allowedStatuses: FineTuningStatus[];
  isProductionReady: boolean;
  missingPrerequisites: string[];
  evaluatedAt: string;
}
