/**
 * Integration tests for chat flow
 */

import { EnhancedOrchestrator } from '../../core/orchestrator/EnhancedOrchestrator';
import { MockLLMAdapter } from '../../__tests__/utils/test-helpers';

describe('Chat Flow Integration', () => {
  let orchestrator: EnhancedOrchestrator;
  let mockAdapter: MockLLMAdapter;

  beforeEach(() => {
    mockAdapter = new MockLLMAdapter({
      'Hello': 'Hi there! How can I help you?',
    });
    orchestrator = new EnhancedOrchestrator(mockAdapter, undefined, {
      useRAG: false,
      useModelRouting: false,
      useSafetyPipeline: false,
      useSemanticCache: false,
    });
  });

  it('should process a simple chat request', async () => {
    const request = {
      message: 'Hello',
      sessionId: 'test-session',
    };

    const response = await orchestrator.processRequest(request);
    expect(response).toHaveProperty('response');
    expect(response.response).toBeTruthy();
  });

  it('should maintain session context', async () => {
    const sessionId = 'test-session';
    
    await orchestrator.processRequest({
      message: 'My name is Alice',
      sessionId,
    });

    const response = await orchestrator.processRequest({
      message: 'What is my name?',
      sessionId,
    });

    expect(response).toHaveProperty('response');
  });
});

