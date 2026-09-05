/**
 * Canonical Chat Runtime Façade
 *
 * Orchestrates canonical chat requests through dependency-injected lifecycle stages:
 * policy -> state -> task -> workflow -> context plan -> context exec -> model ->
 * prompt -> generate -> validate/ground -> state commit -> trace record.
 *
 * Does not read environment variables directly (§838).
 */

import {
  NormalizedChatRequest,
  ChatRuntimeResult,
  chatRuntimeResultSchema,
  TaskClassificationResult,
  ChatContextPlan,
  ChatTraceContext,
} from '../../types/chat-runtime';

export class ChatRuntimeError extends Error {
  constructor(message: string, public readonly stage: string, public readonly cause?: unknown) {
    super(`[ChatRuntime:${stage}] ${message}`);
    this.name = 'ChatRuntimeError';
  }
}

export interface ChatPolicyResolution {
  botProfileId: string;
  allowedModels: string[];
  maxContextTokens: number;
  toolsEnabled: boolean;
  systemPromptOverride?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatConversationState {
  sessionId: string;
  messageHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ChatWorkflowDefinition {
  workflowId: string;
  name: string;
  steps: Array<{ id: string; type: string; config?: Record<string, unknown> }>;
}

export interface ChatExecutionContext {
  retrievedChunks: Array<{
    chunkId: string;
    sourceId: string;
    title: string;
    content: string;
    authority?: number;
    sourceUrl?: string;
  }>;
  memoryItems: string[];
  toolDefinitions?: Array<{ name: string; description: string; parameters?: unknown }>;
  budgetUsed: { contextTokens?: number };
}

export interface ModelSelectionResult {
  provider: string;
  model: string;
  policy: string;
  temperature?: number;
  maxTokens?: number;
  fallbackUsed: boolean;
}

export interface ChatPromptEnvelope {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  contextDocuments: string[];
}

export interface ChatGenerationResult {
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  tokenUsage?: { promptTokens?: number; completionTokens?: number };
}

export interface IChatPolicyResolver {
  resolve(request: NormalizedChatRequest): Promise<ChatPolicyResolution>;
}

export interface IChatStateService {
  load(request: NormalizedChatRequest): Promise<ChatConversationState>;
  commit(params: {
    request: NormalizedChatRequest;
    state: ChatConversationState;
    result: ChatRuntimeResult;
    trace: ChatTraceContext;
  }): Promise<void>;
}

export interface IChatTaskAnalyzer {
  analyze(request: NormalizedChatRequest, state: ChatConversationState): Promise<TaskClassificationResult>;
}

export interface IChatWorkflowResolver {
  resolve(analysis: TaskClassificationResult, request: NormalizedChatRequest): Promise<ChatWorkflowDefinition | undefined>;
}

export interface IChatContextPlanner {
  plan(params: {
    request: NormalizedChatRequest;
    state: ChatConversationState;
    analysis: TaskClassificationResult;
    workflow?: ChatWorkflowDefinition;
    policy: ChatPolicyResolution;
  }): Promise<ChatContextPlan>;
}

export interface IChatContextExecutor {
  execute(plan: ChatContextPlan, request: NormalizedChatRequest): Promise<ChatExecutionContext>;
}

export interface IChatModelPolicyEngine {
  select(params: {
    request: NormalizedChatRequest;
    analysis: TaskClassificationResult;
    context: ChatExecutionContext;
    policy: ChatPolicyResolution;
  }): Promise<ModelSelectionResult>;
}

export interface IChatPromptAssembler {
  assemble(params: {
    request: NormalizedChatRequest;
    state: ChatConversationState;
    analysis: TaskClassificationResult;
    context: ChatExecutionContext;
    policy: ChatPolicyResolution;
    model: ModelSelectionResult;
  }): ChatPromptEnvelope;
}

export interface IChatGenerator {
  generate(model: ModelSelectionResult, prompt: ChatPromptEnvelope): Promise<ChatGenerationResult>;
}

export interface IChatResponsePipeline {
  validateAndGround(params: {
    request: NormalizedChatRequest;
    generation: ChatGenerationResult;
    context: ChatExecutionContext;
    model: ModelSelectionResult;
    traceId: string;
    startTimeMs: number;
  }): Promise<ChatRuntimeResult>;
}

export interface IChatRunRecorder {
  recordStart(request: NormalizedChatRequest): Promise<ChatTraceContext>;
  recordStage(trace: ChatTraceContext, stage: string, durationMs: number): void;
  complete(trace: ChatTraceContext, result: ChatRuntimeResult): Promise<void>;
  fail(trace: ChatTraceContext, error: Error): Promise<void>;
}

export interface ChatRuntimeDependencies {
  policyResolver: IChatPolicyResolver;
  stateService: IChatStateService;
  taskAnalyzer: IChatTaskAnalyzer;
  workflowResolver: IChatWorkflowResolver;
  contextPlanner: IChatContextPlanner;
  contextExecutor: IChatContextExecutor;
  modelPolicy: IChatModelPolicyEngine;
  promptAssembler: IChatPromptAssembler;
  generator: IChatGenerator;
  responsePipeline: IChatResponsePipeline;
  runRecorder?: IChatRunRecorder;
}

export class ChatRuntime {
  constructor(private readonly deps: ChatRuntimeDependencies) {}

  public async execute(request: NormalizedChatRequest): Promise<ChatRuntimeResult> {
    const startTime = Date.now();
    const trace: ChatTraceContext = this.deps.runRecorder
      ? await this.deps.runRecorder.recordStart(request)
      : {
          traceId: `trc_${request.requestId}`,
          requestId: request.requestId,
          sessionId: request.sessionId,
          userId: request.userId,
          stageTimings: {},
          createdAt: new Date().toISOString(),
        };

    const recordStage = (stage: string, durationMs: number) => {
      trace.stageTimings[stage] = durationMs;
      this.deps.runRecorder?.recordStage(trace, stage, durationMs);
    };

    try {
      const pStart = Date.now();
      const policy = await this.deps.policyResolver.resolve(request);
      recordStage('policyResolution', Date.now() - pStart);

      const sStart = Date.now();
      const state = await this.deps.stateService.load(request);
      recordStage('stateLoad', Date.now() - sStart);

      const aStart = Date.now();
      const analysis = await this.deps.taskAnalyzer.analyze(request, state);
      recordStage('taskAnalysis', Date.now() - aStart);

      const wStart = Date.now();
      const workflow = await this.deps.workflowResolver.resolve(analysis, request);
      recordStage('workflowResolution', Date.now() - wStart);

      const plStart = Date.now();
      const contextPlan = await this.deps.contextPlanner.plan({ request, state, analysis, workflow, policy });
      recordStage('contextPlanning', Date.now() - plStart);

      const ceStart = Date.now();
      const context = await this.deps.contextExecutor.execute(contextPlan, request);
      recordStage('contextExecution', Date.now() - ceStart);

      const mStart = Date.now();
      const model = await this.deps.modelPolicy.select({ request, analysis, context, policy });
      recordStage('modelSelection', Date.now() - mStart);

      const prStart = Date.now();
      const prompt = this.deps.promptAssembler.assemble({ request, state, analysis, context, policy, model });
      recordStage('promptAssembly', Date.now() - prStart);

      const gStart = Date.now();
      const generation = await this.deps.generator.generate(model, prompt);
      recordStage('generation', Date.now() - gStart);

      const vStart = Date.now();
      const validatedResult = await this.deps.responsePipeline.validateAndGround({
        request,
        generation,
        context,
        model,
        traceId: trace.traceId,
        startTimeMs: startTime,
      });
      recordStage('validationAndGrounding', Date.now() - vStart);

      const cStart = Date.now();
      await this.deps.stateService.commit({ request, state, result: validatedResult, trace });
      recordStage('stateCommit', Date.now() - cStart);

      const parsedResult = chatRuntimeResultSchema.parse(validatedResult);
      if (this.deps.runRecorder) {
        await this.deps.runRecorder.complete(trace, parsedResult);
      }

      return parsedResult;
    } catch (err: unknown) {
      if (this.deps.runRecorder) {
        await this.deps.runRecorder.fail(trace, err as Error).catch(() => {});
      }
      if (err instanceof ChatRuntimeError) throw err;
      throw new ChatRuntimeError((err as Error).message, 'execution', err);
    }
  }
}
