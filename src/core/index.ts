/**
 * Core module exports - Central export point for all core services
 */

// Analytics
export { AnalyticsService } from './analytics/AnalyticsService';
export type {
  AnalyticsEvent,
  UsageStats,
  UserBehavior,
  UserFeedback,
  TrendData,
} from './analytics/AnalyticsService';

// Learning
export { FeedbackCollector } from './learning/FeedbackCollector';
export { ModelUpdater } from './learning/ModelUpdater';
export type { FeedbackData, FeedbackStats } from './learning/FeedbackCollector';
export type { ModelVersion, FeedbackTrend, UpdateRecommendation } from './learning/ModelUpdater';

// Optimization
export { ToonSerializer, getToonSerializer } from './optimization/ToonSerializer';
export type { TokenStats, SerializationResult } from './optimization/ToonSerializer';

// Agents
export { Agent, AgentTeam, TeamFactory } from './agents/AgentTeam';
export type { AgentConfig, Task, AgentMessage, TeamResult } from './agents/AgentTeam';

// Scheduler
export { TaskScheduler, getTaskScheduler } from './scheduler/TaskScheduler';
export type { ScheduledTask, TaskCondition, TaskExecutionResult } from './scheduler/TaskScheduler';

// Notifications
export { TwilioAdapter } from './notifications/TwilioAdapter';
export type { SMSResult, CallResult, TwilioConfig } from './notifications/TwilioAdapter';

// Providers
export { DeviceAdapter, getDeviceAdapter } from './providers/DeviceAdapter';
export type { DeviceInfo, ModelRecommendation, MemoryStatus } from './providers/DeviceAdapter';

// Contracts
export {
  ContractRegistry,
  BaseUniversalTool,
  createSpec,
  getContractRegistry,
} from './contracts/UniversalContract';
export type {
  UniversalSpec,
  UniversalComponent,
  UniversalModel,
  UniversalTool,
  UniversalAgent,
} from './contracts/UniversalContract';

// RAG
export { CorrectiveRetriever } from './rag/CorrectiveRetriever';
export type { CRAGConfig, CRAGResult, CRAGStats } from './rag/CorrectiveRetriever';

// Knowledge
export { BaseKnowledgeSource } from './knowledge/BaseKnowledgeSource';
export { QueryEnhancer } from './knowledge/QueryEnhancer';
export { CodingKnowledgeBase } from './knowledge/CodingKnowledgeBase';
export { KnowledgeExtractor } from './knowledge/KnowledgeExtractor';
export type { EnhancedQuery, EntityInfo } from './knowledge/QueryEnhancer';
export type { StaticKnowledgeEntry } from './knowledge/KnowledgeExtractor';

// Tools
export { CodingKnowledgeTool } from './tools/CodingKnowledgeTool';
export { KnowledgeLearner } from './learning/KnowledgeLearner';

// Personalization
export { UserProfiler } from './personalization/UserProfiler';
export type { UserProfile, TopicInterest } from './personalization/UserProfiler';

// Multimodal & Video Localization (CF-07)
export { VideoProcessor, getVideoProcessor } from './multimodal/VideoProcessor';
export { ImageProcessor, getImageProcessor } from './multimodal/ImageProcessor';
export {
  createMediaConsentRecord,
  verifyMediaConsentRecord,
  validateConsentForVoiceCloning,
  computeConsentDigest,
  MediaConsentError,
  UnauthorizedVoiceCloningError,
  ConsentDigestMismatchError,
} from './multimodal/localization/MediaConsentRecord';
export type {
  MediaConsentRecord,
  CreateConsentRecordOptions,
} from './multimodal/localization/MediaConsentRecord';
export {
  createVideoLocalizationJob,
  verifyVideoLocalizationJobIntegrity,
  computeLocalizationJobDigest,
  DEFAULT_LOCALIZATION_BUDGET,
  LocalizationJobValidationError,
} from './multimodal/localization/VideoLocalizationJob';
export type {
  VideoLocalizationJob,
  LocalizationStage,
  LocalizationJobStatus,
  LocalizationBudget,
  SyntheticMediaDisclosure,
  LocalizationProvenance,
  LocalizationStageResult,
  CreateLocalizationJobOptions,
} from './multimodal/localization/VideoLocalizationJob';
export { MediaLocalizationSandbox } from './multimodal/localization/MediaLocalizationSandbox';
export type { MediaSandboxPaths } from './multimodal/localization/MediaLocalizationSandbox';
export {
  VideoLocalizationPipeline,
  MockLocalizationEngineAdapter,
  ProductionMediaEngineAdapter,
} from './multimodal/localization';
export type { LocalizationEngineAdapter, ProductionMediaEngineOptions } from './multimodal/localization';

// Tools
export { WebSearcher } from './tools/WebSearcher';
export type { SearchConfig, SearchResult } from './tools/WebSearcher';

// Observability
export {
  logger,
  logPerformance,
  logRequest,
  logError,
  logAudit,
  createChildLogger,
} from './observability/logger';

// Multi-Agent Orchestration (from just-every/code)
export {
  MultiAgentOrchestrator,
  createOpenAIProvider,
  createClaudeProvider,
  createGeminiProvider,
  createOllamaProvider,
  createHuggingFaceProvider,
  // FREE LLM providers
  createGroqProvider,
  createCohereProvider,
  createDeepSeekProvider,
  createOpenRouterProvider,
  createCerebrasProvider,
  createTogetherProvider,
  createMistralProvider,
  // Utilities
  bridgeLLMAdapter,
  autoRegisterProviders,
  createFullOrchestrator,
  getFreeLLMProviders,
} from './agents/MultiAgentOrchestrator';
export type {
  AgentProvider,
  AgentOptions,
  AgentResponse,
  ConsensusResult,
  OrchestrationMode,
  OrchestrationConfig,
} from './agents/MultiAgentOrchestrator';
export { ReasoningController, reasoningController } from './agents/ReasoningController';
export type {
  ReasoningLevel,
  ReasoningConfig,
  ReasoningResult,
} from './agents/ReasoningController';

// Universal LLM Handler
export { UniversalLLM, getUniversalLLM, initializeUniversalLLM } from './providers/UniversalLLM';
export type { UniversalLLMConfig, LLMCapabilities } from './providers/UniversalLLM';

// Automation
export { AutoDrive } from './automation/AutoDrive';
export type {
  Task as AutoDriveTask,
  SubTask,
  TaskStatus,
  TaskResult,
  AutoDriveConfig,
} from './automation/AutoDrive';

// Advanced Memory (from ai-engineering-hub)
export { GraphMemory } from './memory/GraphMemory';
export type {
  Entity,
  Relationship,
  EntityType,
  MemoryQuery,
  MemoryContext,
  GraphMemoryConfig,
} from './memory/GraphMemory';
export { ProjectContext } from './memory/ProjectContext';
export type {
  ProjectInfo,
  DirectoryNode,
  KeyFile,
  ProjectType,
  ProjectContextConfig,
} from './memory/ProjectContext';

// Voice & Audio (from awesome-llm-apps + ai-engineering-hub)
export { VoiceAgent } from './voice/VoiceAgent';
export type {
  VoiceAgentConfig,
  TranscriptionResult,
  SynthesisResult,
  VoiceConversation,
  VoiceTurn,
} from './voice/VoiceAgent';

// Advanced RAG
export { AudioRAG } from './rag/AudioRAG';
export type { AudioDocument, AudioChunk, AudioSearchResult, AudioRAGConfig } from './rag/AudioRAG';
export { VideoRAG } from './rag/VideoRAG';
export type {
  VideoDocument,
  VideoFrame,
  VideoChunk,
  VideoSearchResult,
  VideoRAGConfig,
} from './rag/VideoRAG';
export { TrustRAG } from './rag/TrustRAG';
export type { TrustConfig, TrustScore, TrustRAGResult, RetrievalResult } from './rag/TrustRAG';
export { RAGRouter } from './rag/RAGRouter';
export type { QueryType, RouterConfig, ClassificationResult, RouteResult } from './rag/RAGRouter';

// Browser Automation (from just-every/code & CF-06)
export { BrowserAgent } from './browser/BrowserAgent';
export type { BrowserConfig, PageInfo, BrowserAction, ActionResult } from './browser/BrowserAgent';
export {
  createAuthorizedBrowserJob,
  verifyBrowserJobIntegrity,
  computeBrowserJobDigest,
  computeActionApprovalDigest,
  isOriginAllowed,
  isStateChangingAction,
  validateNoStealthOrEvasion,
  BrowserSecurityError,
  StealthFeatureDisallowedError,
  OriginNotAllowedError,
  StateChangingApprovalRequiredError,
} from './browser/AuthorizedBrowserJob';
export type {
  AuthorizedBrowserJob,
  BrowserJobAction,
  BrowserJobBudget,
  BrowserJobEvidence,
  BrowserJobStatus,
  BrowserActionType,
  CreateBrowserJobOptions,
  StateChangingApproval,
} from './browser/AuthorizedBrowserJob';
export { BrowserJobSandbox } from './browser/BrowserJobSandbox';
export type { SandboxPaths } from './browser/BrowserJobSandbox';
export { BrowserEvidenceCollector } from './browser/BrowserEvidenceCollector';
export {
  BrowserJobRunner,
  MockBrowserDriver,
  PuppeteerBrowserDriver,
  PlaywrightBrowserDriver,
} from './browser/BrowserJobRunner';
export type { BrowserDriver } from './browser/BrowserJobRunner';
export type { PlaywrightDriverOptions } from './browser/PlaywrightBrowserDriver';
export { PydollAdapter, DEFAULT_PYDOLL_CONFIG } from './browser/PydollAdapter';
export type { PydollAdapterConfig } from './browser/PydollAdapter';

// Safety & Approval (from just-every/code)
export { ApprovalPolicy, approvalPolicy } from './safety/ApprovalPolicy';
export type {
  ApprovalLevel,
  ApprovalRequest,
  ApprovalConfig,
  ApprovalHandler,
} from './safety/ApprovalPolicy';
export { SandboxController, sandboxController } from './safety/SandboxController';
export type {
  SandboxMode,
  SandboxConfig,
  ExecutionResult,
  FileOperation,
} from './safety/SandboxController';

// Quality (from just-every/code)
export { AutoReview } from './quality/AutoReview';
export type {
  ReviewResult,
  ReviewIssue,
  ReviewSuggestion,
  AutoReviewConfig,
} from './quality/AutoReview';

// UI (from ai-engineering-hub)
export { ThinkingUI, thinkingUI } from './ui/ThinkingUI';
export type {
  ThinkingStep,
  ThinkingSession,
  ThinkingUIConfig,
  ThinkingCallback,
} from './ui/ThinkingUI';

// Configuration
export { ProfileManager, profileManager } from './config/ProfileManager';
export type { ModelProfile, ModelParameters, ProfilePreset } from './config/ProfileManager';
export { APIKeyManager, apiKeyManager, LLM_PROVIDERS } from './config/APIKeyManager';
export type { LLMProviderInfo, StoredAPIKey } from './config/APIKeyManager';

// Lattice Game Development (CF-08)
export {
  createLatticeScenario,
  validateLatticeWorldSchema,
  computeLatticeWorldDigest,
  computeLatticeScenarioDigest,
  serializeScenario,
  deserializeScenario,
  DEFAULT_LATTICE_BUDGET,
  LatticeSchemaValidationError,
} from './gaming/lattice/LatticeWorldSchema';
export type {
  LatticeVector3,
  TileType,
  LatticeTile,
  LatticeEntity,
  ActionType,
  LatticeAction,
  LatticeWinCondition,
  LatticeBudget,
  LatticeWorldSchema,
  LatticeScenario,
} from './gaming/lattice/LatticeWorldSchema';
export { LatticeSimulationEngine, Mulberry32PRNG } from './gaming/lattice/LatticeSimulationEngine';
export type {
  SimulationSnapshot,
  SimulationResult,
} from './gaming/lattice/LatticeSimulationEngine';
export { LatticeVisualizer } from './gaming/lattice/LatticeVisualizer';
export { LatticeGameAdapter } from './gaming/lattice/LatticeGameAdapter';
export type { IsometricPlaybookResult } from './gaming/lattice/LatticeGameAdapter';

// Unified Capability Hub & Evaluation Gates (CF-09 & CF-10)
export { CapabilityRegistry } from './capabilities/CapabilityRegistry';
export type {
  CapabilityItem,
  CapabilitySection,
  CapabilityMaturity,
  ProcessingLocation,
  CapabilityHealthState,
  ActionDefinition,
  UserRole,
} from './capabilities/CapabilityRegistry';
export { CapabilityJobManager } from './capabilities/CapabilityJobManager';
export type {
  CapabilityJob,
  JobStatus,
  JobCapabilityCategory,
  JobEvidenceRecord,
} from './capabilities/CapabilityJobManager';
export { CapabilityEvaluationSuite } from './capabilities/evaluation/CapabilityEvaluationSuite';
export type {
  EvaluationDomain,
  EvaluationStatus,
  EvaluationCheck,
  EvaluationSuiteResult,
} from './capabilities/evaluation/CapabilityEvaluationSuite';
export { CapabilityObservabilityService } from './capabilities/observability/CapabilityObservabilityService';
export type {
  CapabilityTelemetryEvent,
  ServiceLevelObjective,
  ObservabilityDashboardSummary,
  DiagnosticSupportBundle,
} from './capabilities/observability/CapabilityObservabilityService';
export { CapabilityPromotionEngine } from './capabilities/promotion/CapabilityPromotionEngine';
export type {
  PromotionGateCriterion,
  PromotionEvaluationResult,
  PromotionDecisionRecord,
} from './capabilities/promotion/CapabilityPromotionEngine';
export { CapabilityPersistenceStore } from './capabilities/persistence/CapabilityPersistenceStore';
export { AlertNotificationDispatcher } from './capabilities/observability/AlertNotificationDispatcher';
export type { AlertPayload } from './capabilities/observability/AlertNotificationDispatcher';
export { CanaryCertificationSuite } from './capabilities/evaluation/CanaryCertificationSuite';
export type { CanaryCheckItem, CanaryCertificationReport } from './capabilities/evaluation/CanaryCertificationSuite';
export { LocalHardwareCanary } from './providers/local/LocalHardwareCanary';
export type { HardwareCanaryResult } from './providers/local/LocalHardwareCanary';
export { ProcessTreeSupervisor } from './coding/teams/ProcessTreeSupervisor';
export type { ProcessExecutionOptions, ProcessExecutionResult } from './coding/teams/ProcessTreeSupervisor';

// Context Economy & Reversible Compression (PX-03)
export * from './context-economy';

// Repository Intelligence & Code Health (PX-04)
export * from './repository-intelligence';

// Project Memory & Git Knowledge (PX-05)
export * from './project-memory';

// Lossless Writing, Proofreading, and Review Studio (PX-14)
export * from './writing';

// Source-Grounded Study Studio (PX-15)
export * from './study';

// Visual Website and Click-to-Code Studio (PX-16)
export * from './website';

// Developer Utility Pack: Mock APIs, Skill Export, and Project Tooling (PX-17)
export * from './developer';

