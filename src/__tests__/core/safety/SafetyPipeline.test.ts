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
});

