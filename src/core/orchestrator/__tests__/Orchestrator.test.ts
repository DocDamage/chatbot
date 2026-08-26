import { describe, expect, it, jest } from '@jest/globals';
import { Orchestrator } from '../Orchestrator';

describe('RT-ORCH-001: Orchestrator Pipeline and Contract Flow Suite', () => {
  it('processes chat requests end-to-end through router, contract gate, and LLM adapter', async () => {
    const mockLLM = {
      generate: jest.fn<any>().mockResolvedValue({
        content: 'This is a high quality AI response.',
        model: 'mock-llm',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      }),
      estimateCost: jest.fn<any>().mockReturnValue(0.001),
      isAvailable: jest.fn<any>().mockResolvedValue(true)
    };

    const orchestrator = new Orchestrator(mockLLM as any);
    const response = await orchestrator.processRequest({
      message: 'Hello, please help with TypeScript architecture',
      sessionId: 'session-123'
    });

    expect(response.response).toBe('This is a high quality AI response.');
    expect(response.artifactId).toBeDefined();
    expect(response.model).toBe('mock-llm');
    expect(response.latency).toBeGreaterThanOrEqual(0);
  });
});
