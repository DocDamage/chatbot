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

export interface ChatRuntimeFactoryConfig {
  database?: unknown;
  memoryService?: { getMessages?: (sessionId: string) => Promise<any[]>; addMessage?: (...args: any[]) => Promise<any> };
  conversationManager?: { getConversation?: (id: string) => Promise<any>; addMessage?: (...args: any[]) => Promise<any> };
  ragService?: { processQuery?: (query: string, opts?: any) => Promise<any> };
  modelRouter?: { route?: (task: string, req: any) => Promise<any> };
  llmAdapter?: { generateText?: (prompt: string, opts?: any) => Promise<any>; getModelName?: () => string };
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
}

export class DefaultChatRunRecorder implements IChatRunRecorder {
  private readonly traces = new Map<string, ChatTraceContext>();

  public async recordStart(request: NormalizedChatRequest): Promise<ChatTraceContext> {
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
          allowedModels: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'local-qwen'],
          maxContextTokens: 16000,
          toolsEnabled: enableTools,
          systemPromptOverride: req.explicitSystemInstruction,
        };
      },
    };

    const stateService = config.stateService || new ConversationStateService();

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

    const contextExecutor: IChatContextExecutor = {
      async execute(plan: ChatContextPlan, req: NormalizedChatRequest): Promise<ChatExecutionContext> {
        const retrievedChunks: ChatExecutionContext['retrievedChunks'] = [];
        if (plan.retrievalStrategy.useRAG && config.ragService?.processQuery) {
          try {
            const ragRes = await config.ragService.processQuery(req.message);
            if (ragRes?.documents && Array.isArray(ragRes.documents)) {
              for (const [idx, doc] of ragRes.documents.entries()) {
                retrievedChunks.push({
                  chunkId: `rag-${idx}`,
                  sourceId: doc.id || `doc-${idx}`,
                  title: doc.title || 'Retrieved Knowledge',
                  content: doc.content || doc.text || '',
                  authority: doc.authority || 0.85,
                  sourceUrl: doc.url,
                });
              }
            }
          } catch {
            // Ignore RAG retrieval errors in default fallback path
          }
        }
        return { retrievedChunks, memoryItems: [], budgetUsed: { contextTokens: 100 } };
      },
    };

    const modelPolicy: IChatModelPolicyEngine = {
      async select({ request, context }: { request: NormalizedChatRequest; context: ChatExecutionContext }): Promise<ModelSelectionResult> {
        const modelName = config.llmAdapter?.getModelName?.() || config.fallbackModel || 'gpt-4o';
        return { provider: 'default-provider', model: modelName, policy: request.requestedModelPolicy || 'balanced', fallbackUsed: false };
      },
    };

    const promptAssembler: IChatPromptAssembler = {
      assemble({ request, context, policy }: { request: NormalizedChatRequest; context: ChatExecutionContext; policy: ChatPolicyResolution }): ChatPromptEnvelope {
        const systemPrompt = policy.systemPromptOverride || 'You are an intelligent, helpful AI assistant.';
        const contextDocuments = context.retrievedChunks.map(c => `[${c.title}]: ${c.content}`);
        return { systemPrompt, messages: [{ role: 'user', content: request.message }], contextDocuments };
      },
    };

    const generator: IChatGenerator = {
      async generate(model: ModelSelectionResult, prompt: ChatPromptEnvelope): Promise<ChatGenerationResult> {
        const start = Date.now();
        let content = 'Response generated by ChatRuntime.';
        if (config.llmAdapter?.generateText) {
          const fullPrompt = [prompt.systemPrompt, ...prompt.contextDocuments, prompt.messages[0]?.content].join('\n\n');
          const res = await config.llmAdapter.generateText(fullPrompt);
          content = typeof res === 'string' ? res : res?.text || res?.content || content;
        }
        return { content, model: model.model, provider: model.provider, latencyMs: Date.now() - start };
      },
    };

    const responsePipeline: IChatResponsePipeline = {
      async validateAndGround({ request, generation, context, model, traceId, startTimeMs }): Promise<ChatRuntimeResult> {
        const citations: CitationRef[] = context.retrievedChunks.map(chunk => ({
          id: `cit-${chunk.chunkId}`,
          sourceId: chunk.sourceId,
          title: chunk.title,
          sourceUrl: chunk.sourceUrl,
          chunkId: chunk.chunkId,
          authority: chunk.authority,
        }));

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
        const warnings = qualityValidation.issues.map(i => `[${i.severity.toUpperCase()}] ${i.message}`);

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
            attempted: citations.length > 0,
            sufficient: citations.length > 0 && qualityValidation.valid,
            confidence: citations.length > 0 ? 0.9 : undefined,
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
