import { describe, expect, it, jest } from '@jest/globals';
import { UniversalLLM, getUniversalLLM, initializeUniversalLLM } from '../UniversalLLM';
import { LLMAdapter, LLMResponse } from '../LLMAdapter';

describe('RT-LLM-001: UniversalLLM Provider Discovery and Generation Suite', () => {
  it('falls back to rule-based template generation when no external LLM is reachable', async () => {
    const universal = new UniversalLLM({ fallbackToTemplate: true });
    await universal.initialize();

    const response = await universal.generate({ prompt: 'Hello, how does this work?' });
    expect(response.content).toBeDefined();
    expect(response.model).toBeDefined();
  });

  it('manages custom adapter registration, primary selection, and statistics', async () => {
    const universal = new UniversalLLM({ fallbackToTemplate: false });

    const mockAdapter1: LLMAdapter = {
      generate: jest.fn<() => Promise<LLMResponse>>().mockResolvedValue({
        content: 'Mock 1 output',
        model: 'mock-1',
        tokensUsed: 15
      }),
      getModelName: () => 'mock-1-model',
      estimateCost: () => 0.001
    };

    const mockAdapter2: LLMAdapter = {
      generate: jest.fn<() => Promise<LLMResponse>>().mockResolvedValue({
        content: 'Mock 2 output',
        model: 'mock-2',
        tokensUsed: 15
      }),
      getModelName: () => 'mock-2-model',
      estimateCost: () => 0.002
    };

    universal.registerAdapter('mock1', mockAdapter1, true);
    universal.registerAdapter('mock2', mockAdapter2, false);

    expect(universal.getAvailableProviders()).toEqual(['mock1', 'mock2']);
    expect(universal.getPrimaryAdapter()).toBe(mockAdapter1);

    // Switch primary adapter
    expect(universal.setPrimaryAdapter('mock2')).toBe(true);
    expect(universal.getPrimaryAdapter()).toBe(mockAdapter2);
    expect(universal.setPrimaryAdapter('nonexistent')).toBe(false);

    // Generate with specific provider
    const res2 = await universal.generateWith('mock2', { prompt: 'Test prompt' });
    expect(res2.content).toBe('Mock 2 output');

    await expect(universal.generateWith('nonexistent', { prompt: 'Test' })).rejects.toThrow(
      "Provider 'nonexistent' not available"
    );

    // Handler function
    const handler = universal.getHandler();
    const handlerOutput = await handler('Test prompt via handler');
    expect(handlerOutput).toBe('Mock 2 output');

    // Stats
    const stats = universal.getStats();
    expect(stats.primaryAdapter).toBe('mock-2-model');
    expect(stats.availableAdapters).toContain('mock1');
  });

  it('tries subsequent adapters in sequence when primary adapter throws', async () => {
    const universal = new UniversalLLM({ fallbackToTemplate: false });

    const failingAdapter: LLMAdapter = {
      generate: jest.fn<() => Promise<LLMResponse>>().mockRejectedValue(new Error('Rate limit exceeded')),
      getModelName: () => 'failing-model',
      estimateCost: () => 0
    };

    const fallbackAdapter: LLMAdapter = {
      generate: jest.fn<() => Promise<LLMResponse>>().mockResolvedValue({
        content: 'Fallback succeeded',
        model: 'fallback-model',
        tokensUsed: 10
      }),
      getModelName: () => 'fallback-model',
      estimateCost: () => 0.001
    };

    universal.registerAdapter('failing', failingAdapter, true);
    universal.registerAdapter('fallback', fallbackAdapter, false);

    const response = await universal.generate({ prompt: 'Generate fallback' });
    expect(response.content).toBe('Fallback succeeded');
  });

  it('supports singleton instance creation and initialization', async () => {
    const instance = getUniversalLLM();
    expect(instance).toBeInstanceOf(UniversalLLM);

    const initialized = await initializeUniversalLLM({ fallbackToTemplate: true });
    expect(initialized).toBeInstanceOf(UniversalLLM);
    expect(initialized.getStats().initialized).toBe(true);
  });
});
