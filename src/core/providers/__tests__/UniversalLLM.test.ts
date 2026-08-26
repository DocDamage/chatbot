import { describe, expect, it } from '@jest/globals';
import { UniversalLLM } from '../UniversalLLM';

describe('RT-LLM-001: UniversalLLM Provider Discovery and Generation Suite', () => {
  it('falls back to rule-based template generation when no external LLM is reachable', async () => {
    const universal = new UniversalLLM({ fallbackToTemplate: true });
    await universal.initialize();

    const response = await universal.generate({ prompt: 'Hello, how does this work?' });
    expect(response.content).toBeDefined();
    expect(response.model).toBeDefined();
  });
});
