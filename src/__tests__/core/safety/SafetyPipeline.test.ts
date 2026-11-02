/**
 * Unit tests for SafetyPipeline
 */

import { SafetyPipeline } from '../../../core/safety/SafetyPipeline';
import { MockLLMAdapter } from '../../utils/test-helpers';

describe('SafetyPipeline', () => {
  let safetyPipeline: SafetyPipeline;
  let mockAdapter: MockLLMAdapter;

  beforeEach(() => {
    mockAdapter = new MockLLMAdapter();
    safetyPipeline = new SafetyPipeline(mockAdapter);
  });

  it('should validate safe content', async () => {
    mockAdapter.setResponse('Is this safe?', 'Yes, this content is safe and appropriate.');
    
    const result = await safetyPipeline.validate('This is safe content');
    expect(result).toHaveProperty('safe');
    expect(result).toHaveProperty('confidence');
  });

  it('should detect unsafe content', async () => {
    mockAdapter.setResponse('Is this safe?', 'No, this content contains harmful material.');
    
    const result = await safetyPipeline.validate('Harmful content here');
    expect(result).toHaveProperty('safe');
  });

  it('should provide safety scores', async () => {
    const result = await safetyPipeline.validate('Test content');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.confidence).toBe('number');
  });

  it('runs full check with fact checking and retriever', async () => {
    const mockRetriever = {
      retrieve: jest.fn().mockResolvedValue([{ chunk: { content: 'Fact' }, score: 0.9 }])
    };
    const pipeline = new SafetyPipeline(mockAdapter, mockRetriever as any);
    const result = await pipeline.check('Some text to check', true);
    expect(result).toHaveProperty('safe');
    expect(result.checks.factCheck).toBeDefined();
  });

  it('handles toxic, biased, and high-uncertainty content with mitigation', async () => {
    const toxicBiasText = 'You idiot, all businessmen are always greedy and never honest.';
    mockAdapter.setResponse('Is this safe?', 'No, this violates safety rules.');
    const pipeline = new SafetyPipeline(mockAdapter);

    const result = await pipeline.check(toxicBiasText, false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.safe).toBe(false);
  });
});

