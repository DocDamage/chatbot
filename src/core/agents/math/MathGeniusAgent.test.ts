import { MathGeniusAgent } from './MathGeniusAgent';

describe('MathGeniusAgent', () => {
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
});
