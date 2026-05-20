import { SixSigmaBlackBeltAgent } from './SixSigmaBlackBeltAgent';

describe('SixSigmaBlackBeltAgent', () => {
  it('routes Cpk questions to the deterministic calculator', async () => {
    const agent = new SixSigmaBlackBeltAgent();

    const result = await agent.ask("My mean is 10, USL 10.5, LSL 9.5, std dev .1. What's Cpk?");

    expect(result.intent.kind).toBe('calculator.cpk');
    expect(result.toolResults[0].tool).toBe('calculate_cpk');
    expect(result.response).toContain('Cpk = 1.67');
    expect(result.response).toContain('Cpu');
    expect(result.response).toContain('Cpl');
    expect(result.response).not.toContain('estimated without calculation');
  });

  it('coaches DMAIC project setup with charter, CTQ, and SIPOC', async () => {
    const agent = new SixSigmaBlackBeltAgent();

    const result = await agent.project('Help me define a DMAIC project for reducing customer complaints.');

    expect(result.answerType).toBe('project_coaching');
    expect(result.response).toContain('project charter');
    expect(result.response).toContain('CTQ');
    expect(result.response).toContain('SIPOC');
  });
});
