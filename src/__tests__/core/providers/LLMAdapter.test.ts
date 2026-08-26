/**
 * Unit tests for LLM Adapters
 */

import {
  OpenAIAdapter,
  OpenAICompatibleAdapter,
  TemplateAdapter,
  AnthropicAdapter,
  GeminiAdapter
} from '../../../core/providers/LLMAdapter';
import { MockLLMAdapter } from '../../utils/test-helpers';

describe('RT-LLM-002: LLM Adapters Suite', () => {
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
      expect(adapter.getModelName()).toBe('template');
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

  describe('OpenAIAdapter & OpenAICompatibleAdapter', () => {
    it('creates adapter instances and estimates cost', () => {
      const openai = new OpenAIAdapter('test-key', 'gpt-4');
      expect(openai.getModelName()).toBe('gpt-4');
      expect(openai.estimateCost({ prompt: 'hello world', model: 'gpt-4' })).toBeGreaterThan(0);

      const compatible = new OpenAICompatibleAdapter('custom-provider', 'test-key', 'http://localhost:8000', 'llama-3');
      expect(compatible.getModelName()).toBe('custom-provider:llama-3');
    });
  });

  describe('AnthropicAdapter', () => {
    it('creates anthropic adapter and estimates cost', () => {
      const claude = new AnthropicAdapter('test-key', 'claude-3-5-sonnet-20241022');
      expect(claude.getModelName()).toBe('claude-3-5-sonnet-20241022');
      expect(claude.estimateCost({ prompt: 'explain quantum physics' })).toBeGreaterThan(0);
    });
  });

  describe('GeminiAdapter', () => {
    it('creates gemini adapter and estimates cost', () => {
      const gemini = new GeminiAdapter('test-key', 'gemini-3.6-flash');
      expect(gemini.getModelName()).toBe('gemini-3.6-flash');
      expect(gemini.estimateCost({ prompt: 'explain general relativity' })).toBeGreaterThan(0);
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
