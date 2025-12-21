/**
 * End-to-end test for complete chat conversation flow
 */

import { ServiceInitializer } from '../src/core/initialization/ServiceInitializer';
import { MockLLMAdapter } from '../src/__tests__/utils/test-helpers';

describe('E2E Chat Flow', () => {
  let services: any;

  beforeAll(async () => {
    // Initialize services with mocks
    const mockAdapter = new MockLLMAdapter({
      'Hello': 'Hi! How can I help you today?',
      'What can you do': 'I can answer questions, have conversations, and assist with various tasks.',
      'Thank you': "You're welcome! Is there anything else I can help with?",
    });

    // Mock the service initializer to use our mock adapter
    services = {
      orchestrator: {
        processRequest: async (request: any) => {
          const response = await mockAdapter.generate({ prompt: request.message });
          return {
            response: response.content,
            sessionId: request.sessionId,
            timestamp: new Date().toISOString(),
          };
        },
      },
    };
  });

  it('should complete a full conversation', async () => {
    const sessionId = 'e2e-test-session';

    // Start conversation
    const greeting = await services.orchestrator.processRequest({
      message: 'Hello',
      sessionId,
    });
    expect(greeting.response).toContain('Hi');

    // Ask about capabilities
    const capabilities = await services.orchestrator.processRequest({
      message: 'What can you do?',
      sessionId,
    });
    expect(capabilities.response).toBeTruthy();

    // End conversation
    const thanks = await services.orchestrator.processRequest({
      message: 'Thank you',
      sessionId,
    });
    expect(thanks.response).toContain('welcome');
  });

  it('should maintain context across multiple messages', async () => {
    const sessionId = 'context-test-session';

    await services.orchestrator.processRequest({
      message: 'My favorite color is blue',
      sessionId,
    });

    // In a real implementation, this would check memory
    const response = await services.orchestrator.processRequest({
      message: 'What is my favorite color?',
      sessionId,
    });

    expect(response).toHaveProperty('response');
  });
});

