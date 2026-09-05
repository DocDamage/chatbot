import { describe, expect, it } from '@jest/globals';
import { ReasoningController, reasoningController } from '../ReasoningController';

describe('RT-AGENT-002: ReasoningController Prompting and Thought Parsing Suite', () => {
  it('manages default and custom reasoning levels', () => {
    const controller = new ReasoningController('low');
    expect(controller.getLevel()).toBe('low');

    controller.setLevel('high');
    expect(controller.getLevel()).toBe('high');

    const highConfig = controller.getConfig();
    expect(highConfig.temperature).toBe(0.7);
    expect(highConfig.chainOfThought).toBe(true);

    controller.setCustomConfig('high', { temperature: 0.9 });
    expect(controller.getConfig('high').temperature).toBe(0.9);
  });

  it('builds reasoning prompts with step-by-step instructions and explanation requirements', () => {
    const controller = new ReasoningController();

    const highPrompt = controller.buildReasoningPrompt('How to scale WebSockets?', 'high');
    expect(highPrompt).toContain('Think through this step-by-step with detailed reasoning:');
    expect(highPrompt).toContain('Provide your reasoning along with the answer.');

    const lowPrompt = controller.buildReasoningPrompt('What is 2+2?', 'low');
    expect(lowPrompt).not.toContain('Think step-by-step:');
  });

  it('parses structured XML thinking and answer tags', () => {
    const controller = new ReasoningController();
    const rawResponse = `
<thinking>
1. First evaluate the base condition and ensure all preconditions are satisfied.
2. Next compute the exponential decay rate across the time horizon with high precision.
3. Therefore conclude the final result by evaluating boundaries and confirming stability.
</thinking>
<answer>
The final calculated value is 42 and has been verified with certainty.
</answer>
`;

    const parsed = controller.parseReasoningResponse(rawResponse, 'low');
    expect(parsed.answer).toContain('42');
    expect(parsed.reasoning).toContain('1. First evaluate the base condition');
    expect(parsed.thinkingSteps).toHaveLength(3);
    expect(parsed.confidence).toBeGreaterThan(0.6);
    expect(controller.meetsQualityThreshold(parsed)).toBe(true);
  });

  it('parses keyword-split reasoning and estimates confidence', () => {
    const controller = new ReasoningController();
    const rawResponse = '1. Step one\n2. Step two\n\nTherefore the answer is definitively 100.';
    const parsed = controller.parseReasoningResponse(rawResponse, 'medium');

    expect(parsed.answer).toBe('definitively 100.');
    expect(parsed.confidence).toBeGreaterThan(0.6);

    const uncertainResponse = 'I think maybe perhaps the answer could be 10.';
    const uncertainParsed = controller.parseReasoningResponse(uncertainResponse, 'high');
    expect(controller.meetsQualityThreshold(uncertainParsed)).toBe(false);
  });

  it('suggests reasoning level based on prompt complexity keywords', () => {
    const controller = new ReasoningController();

    expect(controller.suggestLevel('Analyze, compare, and contrast microservices architecture tradeoffs')).toBe('high');
    expect(controller.suggestLevel('What is a quick brief short list?')).toBe('low');
    expect(controller.suggestLevel('Explain how to sort an array in TypeScript')).toBe('medium');
  });

  it('provides model parameters for inference', () => {
    const params = reasoningController.getModelParameters('high');
    expect(params.temperature).toBe(0.7);
    expect(params.max_tokens).toBeGreaterThan(4000);
    expect(params.presence_penalty).toBe(0.1);
  });
});
