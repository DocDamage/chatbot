/**
 * Unit Tests for ChatRuntimeFactory (CRK-P01-T04)
 *
 * Verifies resolution and creation of ChatRuntime from configuration and environment defaults.
 */

import { ChatRuntimeFactory, DefaultChatRunRecorder } from './ChatRuntimeFactory';
import { ChatRuntime } from './ChatRuntime';
import { NormalizedChatRequest } from '../../types/chat-runtime';

describe('ChatRuntimeFactory (CRK-P01-T04)', () => {
  const sampleRequest: NormalizedChatRequest = {
    requestId: 'req-factory-001',
    sessionId: 'session-factory-123',
    message: 'Write a helper function to format dates.',
    botProfileId: 'default',
    mode: 'coding',
    loadedFiles: [],
    loadedAudio: [],
    clientCapabilities: { streaming: false, citations: true, toolApproval: false },
    metadata: {},
  };

  it('creates an operational ChatRuntime instance with default configuration', async () => {
    const runtime = ChatRuntimeFactory.create();
    expect(runtime).toBeInstanceOf(ChatRuntime);

    const result = await runtime.execute(sampleRequest);
    expect(result.requestId).toBe(sampleRequest.requestId);
    expect(result.response).toBeDefined();
    expect(result.model.model).toBe('gpt-4o');
  });

  it('wires custom adapters and RAG service correctly', async () => {
    const mockRagService = {
      processQuery: jest.fn().mockResolvedValue({
        documents: [
          { id: 'doc-1', title: 'Date Formatter Guide', content: 'Use Intl.DateTimeFormat', authority: 0.95 },
        ],
      }),
    };

    const mockLlmAdapter = {
      generateText: jest.fn().mockResolvedValue('Here is the date formatter implementation.'),
      getModelName: jest.fn().mockReturnValue('claude-3-5-sonnet'),
    };

    const recorder = new DefaultChatRunRecorder();

    const runtime = ChatRuntimeFactory.create({
      ragService: mockRagService,
      llmAdapter: mockLlmAdapter,
      runRecorder: recorder,
      fallbackModel: 'claude-3-5-sonnet',
    });

    const result = await runtime.execute(sampleRequest);

    expect(mockRagService.processQuery).toHaveBeenCalledWith(sampleRequest.message);
    expect(mockLlmAdapter.generateText).toHaveBeenCalled();
    expect(result.model.model).toBe('claude-3-5-sonnet');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].title).toBe('Date Formatter Guide');
    expect(result.grounding.sufficient).toBe(true);

    const trace = recorder.getTrace(`trc_${sampleRequest.requestId}`);
    expect(trace).toBeDefined();
    expect(trace?.stageTimings.generation).toBeGreaterThanOrEqual(0);
  });

  it('creates a ChatRuntime instance from environment variables without direct runtime env access', async () => {
    const prevModel = process.env.PRIMARY_LLM_MODEL;
    const prevProfile = process.env.DEFAULT_BOT_PROFILE_ID;

    process.env.PRIMARY_LLM_MODEL = 'gemini-1.5-pro';
    process.env.DEFAULT_BOT_PROFILE_ID = 'custom-default-profile';

    try {
      const runtime = ChatRuntimeFactory.createFromEnv();
      const result = await runtime.execute({
        ...sampleRequest,
        botProfileId: 'custom-default-profile',
      });
      expect(result.model.model).toBe('gemini-1.5-pro');
    } finally {
      process.env.PRIMARY_LLM_MODEL = prevModel;
      process.env.DEFAULT_BOT_PROFILE_ID = prevProfile;
    }
  });
});
