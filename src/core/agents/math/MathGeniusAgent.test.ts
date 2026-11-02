import { describe, expect, it } from '@jest/globals';
import { MathGeniusAgent } from './MathGeniusAgent';
import { MathProblemClassifier } from './MathProblemClassifier';

describe('RT-AGENT-MATH-001: MathGeniusAgent and Problem Classifier Suite', () => {
  it('classifies all mathematical problem domains', () => {
    const classifier = new MathProblemClassifier();
    expect(classifier.classify('Differentiate x^3').kind).toBe('calculus');
    expect(classifier.classify('Prove the Pythagorean theorem').kind).toBe('proof');
    expect(classifier.classify('Calculate the probability and expected value of dice').kind).toBe('probability');
    expect(classifier.classify('Find the eigenvalues of a 3x3 matrix').kind).toBe('linear_algebra');
    expect(classifier.classify('Optimize and minimize cost function').kind).toBe('optimization');
    expect(classifier.classify('Satisfy boolean logic constraint').kind).toBe('logic');
    expect(classifier.classify('Find numeric approximation for root').kind).toBe('numeric');
    expect(classifier.classify('Solve 2x + 5 = 15').kind).toBe('algebra');
  });

  it('solves and verifies a calculus derivative with exact steps', async () => {
    const agent = new MathGeniusAgent();

    const result = await agent.solve('Differentiate x^2 sin(x)');

    expect(result.intent.kind).toBe('calculus');
    expect(result.answer.finalResult).toBe('2*x*sin(x) + x^2*cos(x)');
    expect(result.verification.verified).toBe(true);
    expect(result.verification.method).toContain('symbolic');
    expect(result.answer.steps.length).toBeGreaterThan(0);
    expect(result.answer.confidence).toBe('verified');
  });

  it('handles proof and logic problem workflows', async () => {
    const agent = new MathGeniusAgent();

    const proofResult = await agent.solve('Prove Fermat theorem');
    expect(proofResult.intent.kind).toBe('proof');

    const logicResult = await agent.solve('Satisfy logic constraint');
    expect(logicResult.intent.kind).toBe('logic');

    const algebraResult = await agent.solve('Solve numeric roots');
    expect(algebraResult.toolResults.length).toBeGreaterThan(0);

    const verified = await agent.verify({
      content: 'Verification: passed symbolic verification'
    });
    expect(verified.verified).toBe(true);
  });
});
