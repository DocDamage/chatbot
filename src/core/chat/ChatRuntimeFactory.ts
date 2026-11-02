/**
 * Canonical Chat Runtime Factory
 *
 * Resolves database, memory, RAG, model routing, providers, tools, contracts,
 * safety, validators, feedback, and tracing into a configured ChatRuntime instance.
 * Reads environment variables here so that ChatRuntime itself remains free of direct env access (§838).
 */

import {
  ChatRuntime,
  ChatRuntimeDependencies,
  ChatPolicyResolution,
  ChatConversationState,
  ChatExecutionContext,
  ModelSelectionResult,
  ChatPromptEnvelope,
  ChatGenerationResult,
  IChatPolicyResolver,
  IChatStateService,
  IChatTaskAnalyzer,
  IChatWorkflowResolver,
  IChatContextPlanner,
  IChatContextExecutor,
  IChatModelPolicyEngine,
  IChatPromptAssembler,
  IChatGenerator,
  IChatResponsePipeline,
  IChatRunRecorder,
} from './ChatRuntime';
import {
  NormalizedChatRequest,
  ChatRuntimeResult,
  TaskClassificationResult,
  ChatContextPlan,
  ChatTraceContext,
  CitationRef,
} from '../../types/chat-runtime';
import { ConversationStateService } from '../state/ConversationStateService';
import { WorkflowResolver } from '../workflow/WorkflowResolver';
import { ChatContextPlanner } from './ChatContextPlanner';
import { ResponseQualityGate } from '../validation/ResponseQualityGate';
import { Database } from '../database/Database';
import { ConversationStateRepository } from '../state/ConversationStateRepository';
import { LLMGenerateOptions } from '../providers/LLMAdapter';
import { createContextExecutor, createGenerator, createPromptAssembler } from './ChatRuntimeStages';

export interface ChatRuntimeFactoryConfig {
  database?: Database;
  memoryService?: { getMessages?: (sessionId: string) => Promise<any[]>; addMessage?: (...args: any[]) => Promise<any> };
  conversationManager?: { getConversation?: (id: string) => Promise<any>; addMessage?: (...args: any[]) => Promise<any> };
  ragService?: { processQuery?: (query: string, opts?: any) => Promise<any>; retrieveContext?: (query: string, limit?: number) => Promise<any[]> };
  modelRouter?: { route?: (task: string, req: any) => Promise<any> };
  llmAdapter?: { generate?: (options: LLMGenerateOptions) => Promise<any>; generateText?: (prompt: string, opts?: any) => Promise<any>; getModelName?: () => string };
  toolRegistry?: { getStats?: () => any; listTools?: () => any[] };
  safetyPipeline?: { validate?: (text: string) => Promise<any> };
  runRecorder?: IChatRunRecorder;
  defaultBotProfileId?: string;
  enableRAG?: boolean;
  enableTools?: boolean;
  fallbackModel?: string;
  stateService?: IChatStateService;
  workflowResolver?: IChatWorkflowResolver;
  contextPlanner?: IChatContextPlanner;
  maxContextTokens?: number;
}

export class DefaultChatRunRecorder implements IChatRunRecorder {
  private readonly traces = new Map<string, ChatTraceContext>();

  public async recordStart(request: NormalizedChatRequest): Promise<ChatTraceContext> {
    if (this.traces.size >= 500) this.traces.delete(this.traces.keys().next().value!);
    const trace: ChatTraceContext = {
      traceId: `trc_${request.requestId}`,
      requestId: request.requestId,
      sessionId: request.sessionId,
      userId: request.userId,
      stageTimings: {},
      createdAt: new Date().toISOString(),
    };
    this.traces.set(trace.traceId, trace);
    return trace;
  }

  public recordStage(trace: ChatTraceContext, stage: string, durationMs: number): void {
    trace.stageTimings[stage] = durationMs;
  }

  public async complete(_trace: ChatTraceContext, _result: ChatRuntimeResult): Promise<void> {}

  public async fail(_trace: ChatTraceContext, _error: Error): Promise<void> {}

  public getTrace(traceId: string): ChatTraceContext | undefined {
    return this.traces.get(traceId);
  }
}

export class ChatRuntimeFactory {
  public static create(config: ChatRuntimeFactoryConfig = {}): ChatRuntime {
    const defaultProfile = config.defaultBotProfileId || 'default';
    const enableRAG = config.enableRAG !== false;
    const enableTools = config.enableTools !== false;

    const policyResolver: IChatPolicyResolver = {
      async resolve(req: NormalizedChatRequest): Promise<ChatPolicyResolution> {
        return {
          botProfileId: req.botProfileId || defaultProfile,
          allowedModels: [config.llmAdapter?.getModelName?.() || config.fallbackModel || 'unconfigured'],
          maxContextTokens: config.maxContextTokens || 8192,
          toolsEnabled: enableTools,
          systemPromptOverride: req.explicitSystemInstruction,
        };
      },
    };

    const stateService = config.stateService || new ConversationStateService({
      repository: new ConversationStateRepository(config.database),
      historyReader: config.conversationManager?.getConversation
        ? async sessionId => (await config.conversationManager!.getConversation!(sessionId))?.messages || []
        : undefined,
    });

    const taskAnalyzer: IChatTaskAnalyzer = {
      async analyze(req: NormalizedChatRequest): Promise<TaskClassificationResult> {
        const text = req.message.toLowerCase();
        const isCoding = req.mode === 'coding' || text.includes('code') || text.includes('function') || text.includes('bug');
        return {
          taskType: isCoding ? 'coding' : 'general_qa',
          intent: isCoding ? 'code_assistance' : 'conversation',
          confidence: 0.9,
          heuristicSignals: [req.mode || 'default'],
          requiresTools: isCoding && enableTools,
          requiresGrounding: enableRAG,
        };
      },
    };

    const workflowResolver = config.workflowResolver || new WorkflowResolver();
    const contextPlanner = config.contextPlanner || new ChatContextPlanner();

    const contextExecutor = createContextExecutor(config);

    const modelPolicy: IChatModelPolicyEngine = {
      async select({ request, context }: { request: NormalizedChatRequest; context: ChatExecutionContext }): Promise<ModelSelectionResult> {
        const modelName = config.llmAdapter?.getModelName?.() || config.fallbackModel || 'gpt-4o';
        return { provider: modelName.startsWith('ollama:') ? 'ollama' : 'configured-provider', model: modelName, policy: request.requestedModelPolicy || 'balanced', fallbackUsed: false };
      },
    };

    const promptAssembler = createPromptAssembler();
    const generator = createGenerator(config);

    const responsePipeline: IChatResponsePipeline = {
      async validateAndGround({ request, generation, context, model, traceId, startTimeMs }): Promise<ChatRuntimeResult> {
        const citations: CitationRef[] = context.retrievedChunks.flatMap((chunk, index) => generation.content.includes(`[${index + 1}]`) ? [{
          id: `cit-${index + 1}`,
          sourceId: chunk.sourceId,
          title: chunk.title,
          sourceUrl: chunk.sourceUrl,
          chunkId: chunk.chunkId,
          authority: chunk.authority,
          path: chunk.path,
        }] : []);

        const qualityValidation = ResponseQualityGate.validate({
          requestId: request.requestId,
          userMessage: request.message,
          response: generation.content,
          requiresGrounding: context.retrievedChunks.length > 0,
          model,
          citations,
          retrievedChunks: context.retrievedChunks,
        });

        const finalResponse = qualityValidation.correctedResponse || generation.content;
        const warnings = [...context.warnings || [], ...qualityValidation.issues.map(i => `[${i.severity.toUpperCase()}] ${i.message}`)];
        if (context.retrievedChunks.length > 0 && citations.length === 0) warnings.push('The answer did not cite the supplied documents.');

        return {
          requestId: request.requestId,
          response: finalResponse,
          model,
          citations,
          toolResults: [],
          warnings,
          latencyMs: Date.now() - startTimeMs,
          traceId,
          grounding: {
            attempted: context.retrievedChunks.length > 0,
            sufficient: citations.length > 0 && qualityValidation.valid,
          },
        };
      },
    };

    const deps: ChatRuntimeDependencies = {
      policyResolver,
      stateService,
      taskAnalyzer,
      workflowResolver,
      contextPlanner,
      contextExecutor,
      modelPolicy,
      promptAssembler,
      generator,
      responsePipeline,
      runRecorder: config.runRecorder || new DefaultChatRunRecorder(),
    };

    return new ChatRuntime(deps);
  }

  public static createFromEnv(overrides: Partial<ChatRuntimeFactoryConfig> = {}): ChatRuntime {
    return this.create({
      defaultBotProfileId: process.env.DEFAULT_BOT_PROFILE_ID || 'default',
      enableRAG: process.env.ENABLE_RAG !== 'false',
      enableTools: process.env.ENABLE_TOOL_CALLING !== 'false',
      fallbackModel: process.env.PRIMARY_LLM_MODEL || 'gpt-4o',
      ...overrides,
    });
  }
}
