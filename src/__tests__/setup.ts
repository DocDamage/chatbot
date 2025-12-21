/**
 * Jest test setup file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Mock external services by default
jest.mock('../core/providers/OllamaAdapter', () => ({
  OllamaAdapter: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue({
      content: 'Test response',
      model: 'test-model',
      tokensUsed: 10,
      cost: 0,
      latency: 100,
    }),
    checkAvailability: jest.fn().mockResolvedValue({ available: true, models: [] }),
  })),
}));

// Increase timeout for async operations
jest.setTimeout(10000);

