/**
 * Unit tests for LLM Adapters
 */

import { OpenAIAdapter, TemplateAdapter } from '../../../core/providers/LLMAdapter';
import { MockLLMAdapter } from '../../utils/test-helpers';

describe('LLM Adapters', () => {
  describe('TemplateAdapter', () => {
    let adapter: TemplateAdapter;

    beforeEach(() => {
      adapter = new TemplateAdapter();
    });

    it('should generate a response for known keywords', async () => {
      const response = await adapter.generate({
        prompt: 'hello',
      });

      expect(response.content).toContain('Hello');
      expect(response.model).toBe('template');
      expect(response.cost).toBe(0);
    });

    it('should return fallback response for unknown prompts', async () => {
      const response = await adapter.generate({
        prompt: 'unknown query xyz',
      });

      expect(response.content).toBeTruthy();
      expect(response.model).toBe('template');
    });

    it('should answer capability questions without technical-difficulty language', async () => {
      const response = await adapter.generate({
        prompt: 'what can you do for me?',
      });

      expect(response.content).toContain('I can');
      expect(response.content).not.toContain('technical difficulties');
      expect(response.model).toBe('template');
    });

    it('should not match short greeting keywords inside longer words', async () => {
      const response = await adapter.generate({
        prompt: 'tell me something from 1995',
      });

      expect(response.content).not.toBe('Hi there! What would you like to know?');
      expect(response.model).toBe('template');
    });

    it('should estimate zero cost', () => {
      const cost = adapter.estimateCost({
        prompt: 'test',
      });
      expect(cost).toBe(0);
    });
  });

  describe('MockLLMAdapter', () => {
    let adapter: MockLLMAdapter;

    beforeEach(() => {
      adapter = new MockLLMAdapter({
        'test prompt': 'test response',
      });
    });

    it('should generate mock responses', async () => {
      const response = await adapter.generate({
        prompt: 'test prompt',
      });

      expect(response.content).toBe('test response');
      expect(response.model).toBe('mock-model');
    });

    it('should allow setting custom responses', async () => {
      adapter.setResponse('custom', 'custom response');
      const response = await adapter.generate({
        prompt: 'custom prompt',
      });

      expect(response.content).toBe('custom response');
    });
  });
});

