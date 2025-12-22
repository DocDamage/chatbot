/**
 * Core module exports - Central export point for all core services
 */

// Analytics
export { AnalyticsService } from './analytics/AnalyticsService';
export type { AnalyticsEvent, UsageStats, UserBehavior, UserFeedback, TrendData } from './analytics/AnalyticsService';

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
export { ContractRegistry, BaseUniversalTool, createSpec, getContractRegistry } from './contracts/UniversalContract';
export type { UniversalSpec, UniversalComponent, UniversalModel, UniversalTool, UniversalAgent } from './contracts/UniversalContract';

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

// Multimodal
export { VideoProcessor, getVideoProcessor } from './multimodal/VideoProcessor';
export { ImageProcessor, getImageProcessor } from './multimodal/ImageProcessor';

// Tools
export { WebSearcher } from './tools/WebSearcher';
export type { SearchConfig, SearchResult } from './tools/WebSearcher';

// Observability
export { logger, logPerformance, logRequest, logError, logAudit, createChildLogger } from './observability/logger';

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
    getFreeLLMProviders
} from './agents/MultiAgentOrchestrator';
export type { AgentProvider, AgentOptions, AgentResponse, ConsensusResult, OrchestrationMode, OrchestrationConfig } from './agents/MultiAgentOrchestrator';
export { ReasoningController, reasoningController } from './agents/ReasoningController';
export type { ReasoningLevel, ReasoningConfig, ReasoningResult } from './agents/ReasoningController';

// Universal LLM Handler
export { UniversalLLM, getUniversalLLM, initializeUniversalLLM } from './providers/UniversalLLM';
export type { UniversalLLMConfig, LLMCapabilities } from './providers/UniversalLLM';

// Automation
export { AutoDrive } from './automation/AutoDrive';
export type { Task as AutoDriveTask, SubTask, TaskStatus, TaskResult, AutoDriveConfig } from './automation/AutoDrive';

// Advanced Memory (from ai-engineering-hub)
export { GraphMemory } from './memory/GraphMemory';
export type { Entity, Relationship, EntityType, MemoryQuery, MemoryContext, GraphMemoryConfig } from './memory/GraphMemory';
export { ProjectContext } from './memory/ProjectContext';
export type { ProjectInfo, DirectoryNode, KeyFile, ProjectType, ProjectContextConfig } from './memory/ProjectContext';

// Voice & Audio (from awesome-llm-apps + ai-engineering-hub)
export { VoiceAgent } from './voice/VoiceAgent';
export type { VoiceAgentConfig, TranscriptionResult, SynthesisResult, VoiceConversation, VoiceTurn } from './voice/VoiceAgent';

// Advanced RAG
export { AudioRAG } from './rag/AudioRAG';
export type { AudioDocument, AudioChunk, AudioSearchResult, AudioRAGConfig } from './rag/AudioRAG';
export { VideoRAG } from './rag/VideoRAG';
export type { VideoDocument, VideoFrame, VideoChunk, VideoSearchResult, VideoRAGConfig } from './rag/VideoRAG';
export { TrustRAG } from './rag/TrustRAG';
export type { TrustConfig, TrustScore, TrustRAGResult, RetrievalResult } from './rag/TrustRAG';
export { RAGRouter } from './rag/RAGRouter';
export type { QueryType, RouterConfig, ClassificationResult, RouteResult } from './rag/RAGRouter';

// Browser Automation (from just-every/code)
export { BrowserAgent } from './browser/BrowserAgent';
export type { BrowserConfig, PageInfo, BrowserAction, ActionResult } from './browser/BrowserAgent';

// Safety & Approval (from just-every/code)
export { ApprovalPolicy, approvalPolicy } from './safety/ApprovalPolicy';
export type { ApprovalLevel, ApprovalRequest, ApprovalConfig, ApprovalHandler } from './safety/ApprovalPolicy';
export { SandboxController, sandboxController } from './safety/SandboxController';
export type { SandboxMode, SandboxConfig, ExecutionResult, FileOperation } from './safety/SandboxController';

// Quality (from just-every/code)
export { AutoReview } from './quality/AutoReview';
export type { ReviewResult, ReviewIssue, ReviewSuggestion, AutoReviewConfig } from './quality/AutoReview';

// UI (from ai-engineering-hub)
export { ThinkingUI, thinkingUI } from './ui/ThinkingUI';
export type { ThinkingStep, ThinkingSession, ThinkingUIConfig, ThinkingCallback } from './ui/ThinkingUI';

// Configuration
export { ProfileManager, profileManager } from './config/ProfileManager';
export type { ModelProfile, ModelParameters, ProfilePreset } from './config/ProfileManager';
export { APIKeyManager, apiKeyManager, LLM_PROVIDERS } from './config/APIKeyManager';
export type { LLMProviderInfo, StoredAPIKey } from './config/APIKeyManager';
