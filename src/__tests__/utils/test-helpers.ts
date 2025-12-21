/**
 * Test utilities and helpers
 */

import { LLMAdapter, LLMGenerateOptions, LLMResponse } from '../../core/providers/LLMAdapter';
import { DocumentChunk } from '../../types/rag';

/**
 * Mock LLM Adapter for testing
 */
export class MockLLMAdapter implements LLMAdapter {
  private responses: Map<string, string> = new Map();

  constructor(responses?: Record<string, string>) {
    if (responses) {
      Object.entries(responses).forEach(([key, value]) => {
        this.responses.set(key, value);
      });
    }
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const key = options.prompt.substring(0, 50);
    const content = this.responses.get(key) || 'Mock response';
    
    return {
      content,
      model: 'mock-model',
      tokensUsed: content.length / 4,
      cost: 0,
      latency: 50,
    };
  }

  estimateCost(options: LLMGenerateOptions): number {
    return 0;
  }

  getModelName(): string {
    return 'mock-model';
  }

  setResponse(prompt: string, response: string): void {
    this.responses.set(prompt.substring(0, 50), response);
  }
}

/**
 * Create mock document chunks
 */
export function createMockChunks(count: number = 3): DocumentChunk[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `chunk-${i}`,
    content: `This is test chunk ${i} with some content for testing purposes.`,
    metadata: {
      source: `test-source-${i}`,
      title: `Test Document ${i}`,
      chunkIndex: i,
    },
    embedding: Array.from({ length: 384 }, () => Math.random()),
  }));
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock request
 */
export function createMockRequest(body: any = {}) {
  return {
    body,
    headers: {},
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/chat',
  };
}

/**
 * Create mock response
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Create mock next function
 */
export function createMockNext() {
  return jest.fn();
}

