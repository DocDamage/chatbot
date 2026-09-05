/**
 * CRK Section 56: Final Definition of Done for the Canonical Chatbot Runtime
 */

export interface RuntimeCategoryStatus {
  allDefaultChatApisCanonical: boolean;
  duplicateBehaviorEliminated: boolean;
  conversationStateWorking: boolean;
  contextPlannerWorking: boolean;
  promptAssemblyBudgeted: boolean;
  modelRoutingConfiguredCapabilities: boolean;
  truthfulFallback: boolean;
  groundingAbstention: boolean;
  toolClaimsMatchEvidence: boolean;
  requestDiagnosticsExist: boolean;
}

export interface KnowledgeCategoryStatus {
  datasetsAndPacksVersioned: boolean;
  officialDocsAvailableCoding: boolean;
  scoringFreshnessAuthorityVersionWorking: boolean;
  developerQaFilteredProvenanced: boolean;
  curatedCodeStructurallyIndexed: boolean;
  defaultPacksAbEvidence: boolean;
  broadWebPacksOptional: boolean;
  incrementalUpdateWorking: boolean;
  failedUpdatesRetainActiveVersion: boolean;
}

export interface DataCategoryStatus {
  sqliteMigrationsPass: boolean;
  postgresMigrationsPass: boolean;
  datasetJobStateSurvivesRestart: boolean;
  conversationVariablesRetentionDeletionWorking: boolean;
  privacyRulesImplemented: boolean;
}

export interface QualityCategoryStatus {
  goldenSuiteMeetsThresholds: boolean;
  versionConflictTestsPass: boolean;
  promptInjectionRagTestsPass: boolean;
  crossUserRetrievalTestsPass: boolean;
  codingNoOverclaimTestsPass: boolean;
  datasetAbEvidenceRecorded: boolean;
}

export interface UICategoryStatus {
  defaultChatRemainsSimple: boolean;
  sourcesInspectable: boolean;
  feedbackAvailable: boolean;
  knowledgeManagerWorks: boolean;
  modelPolicySelectionWorks: boolean;
  diagnosticsRedactedDeveloperOnly: boolean;
  accessibleDegradedLoadingStates: boolean;
}

export interface OperationsCategoryStatus {
  runtimeStageMetricsExist: boolean;
  datasetUpdateMetricsExist: boolean;
  staleFailureAlertsExist: boolean;
  knowledgeRefreshRunbookExists: boolean;
  runtimeRollbackDemonstrated: boolean;
  datasetVersionRollbackDemonstrated: boolean;
}

export type DoDDomain = 'runtime' | 'knowledge' | 'data' | 'quality' | 'ui' | 'operations';

export interface DefinitionOfDoneEvaluationInput {
  runtime?: Partial<RuntimeCategoryStatus>;
  knowledge?: Partial<KnowledgeCategoryStatus>;
  data?: Partial<DataCategoryStatus>;
  quality?: Partial<QualityCategoryStatus>;
  ui?: Partial<UICategoryStatus>;
  operations?: Partial<OperationsCategoryStatus>;
}

export interface DomainCheckResult {
  domain: DoDDomain;
  totalCriteria: number;
  passedCriteria: number;
  isSatisfied: boolean;
  unmetCriteria: string[];
}

export interface RuntimeDoDCertification {
  isCertified: boolean;
  totalCriteria: number;
  passedCriteria: number;
  completionRate: number;
  domainResults: Record<DoDDomain, DomainCheckResult>;
  allUnmetCriteria: string[];
  evaluatedAt: string;
}
