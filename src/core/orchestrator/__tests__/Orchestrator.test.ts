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

    // Cache hit on identical subsequent request
    const cachedResponse = await orchestrator.processRequest({
      message: 'Hello, please help with TypeScript architecture',
      sessionId: 'session-123'
    });
    expect(cachedResponse.response).toBe('This is a high quality AI response.');
    expect(orchestrator.getCacheStats()).toBeDefined();
  });

  it('handles image generation requests when image adapter is configured', async () => {
    const mockLLM = {
      generate: jest.fn<any>().mockResolvedValue({
        content: 'A futuristic city skyline with glowing neon lights',
        model: 'mock-llm',
        usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 }
      }),
      estimateCost: jest.fn<any>().mockReturnValue(0.001),
      isAvailable: jest.fn<any>().mockResolvedValue(true)
    };

    const mockImageAdapter = {
      generate: jest.fn<any>().mockResolvedValue({
        image: 'base64-image-data',
        imageUrl: 'https://example.com/image.png',
        model: 'stable-diffusion-xl',
        latency: 120
      }),
      isAvailable: jest.fn<any>().mockResolvedValue(true)
    };

    const orchestrator = new Orchestrator(mockLLM as any, mockImageAdapter as any);
    const response = await orchestrator.processRequest({
      message: 'generate image of a futuristic neon cyber city',
      sessionId: 'session-img'
    });

    expect(response.response).toContain('Generated an image');
    expect(response.image).toBe('base64-image-data');
    expect(response.imageUrl).toBe('https://example.com/image.png');
  });

  it('falls back gracefully when LLM generation fails after max retries', async () => {
    const failingLLM = {
      generate: jest.fn<any>().mockRejectedValue(new Error('LLM provider error: quota exhausted')),
      estimateCost: jest.fn<any>().mockReturnValue(0.001),
      isAvailable: jest.fn<any>().mockResolvedValue(true)
    };

    const orchestrator = new Orchestrator(failingLLM as any);
    const response = await orchestrator.processRequest({
      message: 'Explain relativity in detail',
      sessionId: 'session-fail'
    });

    expect(response.model).toBe('fallback');
    expect(response.response).toContain('having trouble processing');
    expect(response.warnings).toContain('Used fallback response due to errors');
  });
});
