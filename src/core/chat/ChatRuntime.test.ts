/**
 * Unit Tests for ChatRuntime (CRK-P01-T03)
 *
 * Verifies stage orchestration order, data propagation, timing records,
 * error handling, and schema validation.
 */

import {
  ChatRuntime,
  ChatRuntimeDependencies,
  ChatRuntimeError,
  ChatPolicyResolution,
  ChatConversationState,
  ChatWorkflowDefinition,
  ChatExecutionContext,
  ModelSelectionResult,
  ChatPromptEnvelope,
  ChatGenerationResult,
} from './ChatRuntime';
import {
  NormalizedChatRequest,
  ChatRuntimeResult,
  TaskClassificationResult,
  ChatContextPlan,
  ChatTraceContext,
} from '../../types/chat-runtime';

describe('ChatRuntime (CRK-P01-T03)', () => {
  const sampleRequest: NormalizedChatRequest = {
    requestId: 'req-sample-001',
    sessionId: 'session-abc-123',
    userId: 'user-xyz-456',
    message: 'Can you explain how the ChatRuntime executes requests?',
    botProfileId: 'default',
    loadedFiles: [],
    loadedAudio: [],
    clientCapabilities: { streaming: false, citations: true, toolApproval: false },
    metadata: {},
  };

  function createMockDependencies(): {
    deps: ChatRuntimeDependencies;
    spies: Record<string, jest.Mock>;
  } {
    const policyResult: ChatPolicyResolution = {
      botProfileId: 'default',
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
      maxContextTokens: 8000,
      toolsEnabled: true,
    };

    const stateResult: ChatConversationState = {
      sessionId: sampleRequest.sessionId,
      messageHistory: [{ role: 'user', content: sampleRequest.message }],
      variables: { userTier: 'pro' },
    };

    const analysisResult: TaskClassificationResult = {
      taskType: 'general_qa',
      intent: 'explain_architecture',
      confidence: 0.95,
      heuristicSignals: ['explains', 'runtime'],
      requiresTools: false,
      requiresGrounding: true,
    };

    const workflowResult: ChatWorkflowDefinition = {
      workflowId: 'wf-qa-grounded',
      name: 'Grounded QA Workflow',
      steps: [{ id: 'step-1', type: 'knowledge_query' }],
    };

    const planResult: ChatContextPlan = {
      requestId: sampleRequest.requestId,
      traceId: 'trc-sample-001',
      taskClassification: analysisResult,
      retrievalStrategy: { useRAG: true, maxSources: 3 },
      memoryStrategy: { includeHistory: true, maxMessages: 5 },
      toolStrategy: { enabledTools: [] },
      modelStrategy: { policy: 'balanced', preferredModel: 'gpt-4o' },
    };

    const contextResult: ChatExecutionContext = {
      retrievedChunks: [
        {
          chunkId: 'chk-1',
          sourceId: 'src-1',
          title: 'ChatRuntime Docs',
          content: 'ChatRuntime coordinates lifecycle stages.',
          authority: 0.95,
        },
      ],
      memoryItems: ['Previous conversation turn'],
      budgetUsed: { contextTokens: 450 },
    };

    const modelResult: ModelSelectionResult = {
      provider: 'openai',
      model: 'gpt-4o',
      policy: 'balanced',
      fallbackUsed: false,
    };

    const promptResult: ChatPromptEnvelope = {
      systemPrompt: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: sampleRequest.message }],
      contextDocuments: ['ChatRuntime coordinates lifecycle stages.'],
    };

    const genResult: ChatGenerationResult = {
      content: 'ChatRuntime is the canonical orchestrating façade.',
      model: 'gpt-4o',
      provider: 'openai',
      latencyMs: 120,
    };

    const validatedResult: ChatRuntimeResult = {
      requestId: sampleRequest.requestId,
      response: 'ChatRuntime is the canonical orchestrating façade.',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        policy: 'balanced',
        fallbackUsed: false,
      },
      citations: [
        {
          id: 'cit-1',
          sourceId: 'src-1',
          title: 'ChatRuntime Docs',
          chunkId: 'chk-1',
          authority: 0.95,
        },
      ],
      toolResults: [],
      warnings: [],
      latencyMs: 150,
      traceId: 'trc-sample-001',
      grounding: { attempted: true, sufficient: true, confidence: 0.92 },
    };

    const traceContext: ChatTraceContext = {
      traceId: 'trc-sample-001',
      requestId: sampleRequest.requestId,
      sessionId: sampleRequest.sessionId,
      userId: sampleRequest.userId,
      stageTimings: {},
      createdAt: new Date().toISOString(),
    };

    const spies = {
      resolvePolicy: jest.fn().mockResolvedValue(policyResult),
      loadState: jest.fn().mockResolvedValue(stateResult),
      commitState: jest.fn().mockResolvedValue(undefined),
      analyzeTask: jest.fn().mockResolvedValue(analysisResult),
      resolveWorkflow: jest.fn().mockResolvedValue(workflowResult),
      planContext: jest.fn().mockResolvedValue(planResult),
      executeContext: jest.fn().mockResolvedValue(contextResult),
      selectModel: jest.fn().mockResolvedValue(modelResult),
      assemblePrompt: jest.fn().mockReturnValue(promptResult),
      generate: jest.fn().mockResolvedValue(genResult),
      validateAndGround: jest.fn().mockResolvedValue(validatedResult),
      recordStart: jest.fn().mockResolvedValue(traceContext),
      recordStage: jest.fn(),
      completeTrace: jest.fn().mockResolvedValue(undefined),
      failTrace: jest.fn().mockResolvedValue(undefined),
    };

    const deps: ChatRuntimeDependencies = {
      policyResolver: { resolve: spies.resolvePolicy },
      stateService: { load: spies.loadState, commit: spies.commitState },
      taskAnalyzer: { analyze: spies.analyzeTask },
      workflowResolver: { resolve: spies.resolveWorkflow },
      contextPlanner: { plan: spies.planContext },
      contextExecutor: { execute: spies.executeContext },
      modelPolicy: { select: spies.selectModel },
      promptAssembler: { assemble: spies.assemblePrompt },
      generator: { generate: spies.generate },
      responsePipeline: { validateAndGround: spies.validateAndGround },
      runRecorder: {
        recordStart: spies.recordStart,
        recordStage: spies.recordStage,
        complete: spies.completeTrace,
        fail: spies.failTrace,
      },
    };

    return { deps, spies };
  }

  it('executes end-to-end through all lifecycle stages and returns a schema-validated result', async () => {
    const { deps, spies } = createMockDependencies();
    const runtime = new ChatRuntime(deps);

    const result = await runtime.execute(sampleRequest);

    expect(result.requestId).toBe(sampleRequest.requestId);
    expect(result.response).toBe('ChatRuntime is the canonical orchestrating façade.');
    expect(result.model.model).toBe('gpt-4o');
    expect(result.citations).toHaveLength(1);
    expect(result.grounding.sufficient).toBe(true);

    // Verify stage call sequence
    expect(spies.recordStart).toHaveBeenCalledWith(sampleRequest);
    expect(spies.resolvePolicy).toHaveBeenCalledWith(sampleRequest);
    expect(spies.loadState).toHaveBeenCalledWith(sampleRequest);
    expect(spies.analyzeTask).toHaveBeenCalledWith(sampleRequest, expect.any(Object));
    expect(spies.resolveWorkflow).toHaveBeenCalledWith(expect.any(Object), sampleRequest);
    expect(spies.planContext).toHaveBeenCalledWith(expect.objectContaining({ request: sampleRequest }));
    expect(spies.executeContext).toHaveBeenCalledWith(expect.any(Object), sampleRequest);
    expect(spies.selectModel).toHaveBeenCalledWith(expect.objectContaining({ request: sampleRequest }));
    expect(spies.assemblePrompt).toHaveBeenCalledWith(expect.objectContaining({ request: sampleRequest }));
    expect(spies.generate).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    expect(spies.validateAndGround).toHaveBeenCalledWith(expect.objectContaining({ request: sampleRequest }));
    expect(spies.commitState).toHaveBeenCalledWith(expect.objectContaining({ request: sampleRequest, result }));
    expect(spies.completeTrace).toHaveBeenCalledWith(expect.any(Object), result);
  });

  it('records timing for every execution stage', async () => {
    const { deps, spies } = createMockDependencies();
    const runtime = new ChatRuntime(deps);

    await runtime.execute(sampleRequest);

    const stagesRecorded = spies.recordStage.mock.calls.map(call => call[1]);
    expect(stagesRecorded).toEqual(
      expect.arrayContaining([
        'policyResolution',
        'stateLoad',
        'taskAnalysis',
        'workflowResolution',
        'contextPlanning',
        'contextExecution',
        'modelSelection',
        'promptAssembly',
        'generation',
        'validationAndGrounding',
        'stateCommit',
      ])
    );
  });

  it('works correctly when runRecorder is omitted', async () => {
    const { deps } = createMockDependencies();
    delete deps.runRecorder;
    const runtime = new ChatRuntime(deps);

    const result = await runtime.execute(sampleRequest);
    expect(result.requestId).toBe(sampleRequest.requestId);
    expect(result.response).toBeDefined();
  });

  it('handles stage failures by notifying runRecorder and wrapping in ChatRuntimeError', async () => {
    const { deps, spies } = createMockDependencies();
    spies.generate.mockRejectedValue(new Error('LLM connection reset by peer'));
    const runtime = new ChatRuntime(deps);

    await expect(runtime.execute(sampleRequest)).rejects.toThrow(ChatRuntimeError);
    expect(spies.failTrace).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ message: 'LLM connection reset by peer' })
    );
    expect(spies.commitState).not.toHaveBeenCalled();
    expect(spies.completeTrace).not.toHaveBeenCalled();
  });

  it('rejects result that fails schema validation before returning', async () => {
    const { deps, spies } = createMockDependencies();
    // Return invalid latency (negative) which violates chatRuntimeResultSchema
    spies.validateAndGround.mockResolvedValue({
      requestId: sampleRequest.requestId,
      response: 'Invalid result test',
      model: { provider: 'test', model: 'test', policy: 'test', fallbackUsed: false },
      citations: [],
      toolResults: [],
      warnings: [],
      latencyMs: -10, // Invalid: must be non-negative
      traceId: 'trc-001',
      grounding: { attempted: false, sufficient: false },
    });

    const runtime = new ChatRuntime(deps);
    await expect(runtime.execute(sampleRequest)).rejects.toThrow(ChatRuntimeError);
  });
});
