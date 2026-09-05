/**
 * CRK Sections 57 through 63: Program Completion, Verification, Governance & Certification Types
 */

// Section 57: Required Implementation Commands
export type ImplementationCommandId =
  | 'test:chat-runtime'
  | 'test:conversation-state'
  | 'test:context-planner'
  | 'test:knowledge'
  | 'test:knowledge:migrations'
  | 'test:retrieval'
  | 'test:model-policy'
  | 'test:prompt-assembler'
  | 'test:grounding'
  | 'test:tool-truth'
  | 'test:feedback'
  | 'test:chat-diagnostics'
  | 'eval:chat:smoke'
  | 'eval:chat:full'
  | 'eval:retrieval'
  | 'eval:datasets';

export interface ImplementationCommandConfig {
  id: ImplementationCommandId;
  description: string;
  category: 'unit_integration' | 'eval_regression';
  commandLine: string;
  isFakeOrMockProhibited: boolean;
}

// Section 58: Required Knowledge Pack Evidence
export type RequiredPackEvidenceArtifact =
  | 'manifest'
  | 'license_review'
  | 'source_version'
  | 'install_evidence'
  | 'document_chunk_counts'
  | 'filter_counts'
  | 'duplicate_counts'
  | 'embedding_model_version'
  | 'storage_size'
  | 'retrieval_benchmark'
  | 'answer_quality_ab'
  | 'latency_impact'
  | 'known_limitations'
  | 'update_policy'
  | 'rollback_evidence';

export interface PackEvidenceAuditResult {
  packId: string;
  isDefaultPromoted: boolean;
  totalRequiredArtifacts: number;
  presentArtifacts: RequiredPackEvidenceArtifact[];
  missingArtifacts: RequiredPackEvidenceArtifact[];
  isFullyEvidenced: boolean;
}

// Section 59: Task-Level Definition of Done
export interface TaskDoDChecklist {
  // Implementation
  completeBehavior: boolean;
  noPlaceholderProductionPath: boolean;
  noDuplicateCompetingBehavior: boolean;
  sourceSizeRuleSatisfied: boolean;
  configurationTyped: boolean;
  databaseChangeHasMigration: boolean;
  // Tests
  focusedUnitTests: boolean;
  integrationTests: boolean;
  securityTests: boolean;
  browserTests: boolean;
  evalCases: boolean;
  failureNegativeCases: boolean;
  // Verification
  typeCheckPass: boolean;
  lintPass: boolean;
  affectedSuitesPass: boolean;
  buildPass: boolean;
  runtimeQaPass: boolean;
  sqlitePostgresVerified: boolean;
  // Evidence
  exactCommitShaRecorded: boolean;
  commandsExitCodesRecorded: boolean;
  changedFilesRecorded: boolean;
  evidenceBundleCreated: boolean;
  masterTrackerUpdated: boolean;
  featureManifestUpdated: boolean;
  handoffUpdated: boolean;
}

export interface TaskDoDAuditResult {
  taskId: string;
  isComplete: boolean;
  failedGates: string[];
}

// Section 60: New-Thread Implementation Prompt Template
export interface ImplementationPromptContext {
  taskId: string;
  taskTitle: string;
  currentBranch: string;
  currentCommit: string;
  relevantFiles: string[];
  baselineBehavior: string;
  implementationApproach: string;
  verificationCommands: string[];
}

// Section 61: Handoff Additions for CRK Tasks
export interface CRKHandoffMetadata {
  runtimeStageAffected?: string;
  promptVersion?: string;
  modelPolicyVersion?: string;
  retrievalPolicyVersion?: string;
  datasetPackId?: string;
  datasetVersion?: string;
  migrationIds?: string[];
  backwardCompatibility?: string;
  featureFlag?: string;
  shadowCanaryStatus?: string;
  goldenCasesAddedChanged?: string;
  abResult?: string;
  rollbackMethod?: string;
}

// Section 62: Prohibited Shortcuts
export type ProhibitedShortcutCode =
  | 'FORWARD_ONLY_SHIM'
  | 'HEURISTIC_WITHOUT_BOUNDARY'
  | 'DATASET_BEFORE_PROVENANCE'
  | 'UNFILTERED_HUGE_CORPUS'
  | 'SIMILARITY_ONLY_RANKING'
  | 'FRAMEWORK_WITHOUT_VERSION'
  | 'GUESSED_MODEL_ATTRIBUTES'
  | 'PROVIDER_FAILURE_MASKING'
  | 'INDISCRIMINATE_RAG'
  | 'UNFILTERED_MEMORY_DUMP'
  | 'THUMBS_UP_AUTO_TRAINING'
  | 'PRIVATE_COT_IN_DIAGNOSTICS'
  | 'CLAIMING_MUTATION_WITHOUT_APPLY'
  | 'CLAIMING_TESTS_WITHOUT_RUN'
  | 'UNBENCHMARKED_VECTOR_STORE'
  | 'LOWERED_EVAL_THRESHOLDS'
  | 'EVAL_EXAMPLES_IN_RAG'
  | 'IMPORT_EQUATED_TO_QUALITY'
  | 'IN_PLACE_MUTABLE_DATASET'
  | 'FALSE_FRESHNESS_WITHOUT_DISCLOSURE';

export interface ProhibitedShortcutViolation {
  code: ProhibitedShortcutCode;
  description: string;
  affectedComponent: string;
  remediation: string;
}

// Section 63: Final Completion Pillars
export type ProgramCompletionPillar =
  | 'CANONICAL_CHAT_RUNTIME'
  | 'CONVERSATION_STATE'
  | 'CONTEXT_PLANNER'
  | 'BOT_CONFIG_PROFILES'
  | 'MODEL_ROUTING_POLICY'
  | 'GOVERNED_KNOWLEDGE_PACKS'
  | 'VERSION_AWARE_RETRIEVAL'
  | 'GROUNDING_AND_ABSTENTION'
  | 'STRUCTURED_CITATIONS'
  | 'TRUTHFUL_TOOL_LEDGER'
  | 'UNIFIED_FEEDBACK'
  | 'REPRODUCIBLE_EVALS_MAINTENANCE';

export interface ProgramCompletionCertification {
  programId: string;
  is100PercentComplete: boolean;
  totalSections: number;
  certifiedSections: number;
  activePillars: Record<ProgramCompletionPillar, boolean>;
  allPillarsSatisfied: boolean;
  certifiedAt: string;
  certificationAuthority: string;
}
