import { PhilosophyGeniusAgent } from './PhilosophyGeniusAgent';

describe('PhilosophyGeniusAgent', () => {
  it('maps arguments and checks fallacy risks', async () => {
    const agent = new PhilosophyGeniusAgent();

    const result = await agent.argument('Claim that we should ban it because everyone knows it is harmful.');

    expect(result.model).toBe('philosophy-tools');
    expect(result.response).toContain('ArgumentMapTool');
    expect(result.response).toContain('FallacyDetectionTool');
    expect(result.response).toContain('appeal_to_common_belief');
  });

  it('builds fair debate counterarguments', async () => {
    const agent = new PhilosophyGeniusAgent();

    const result = await agent.debate('Give me a steelman counterargument for this policy.');

    expect(result.response).toContain('CounterargumentTool');
    expect(result.response).toContain('supporters would recognize as fair');
  });

  it('frames ethical questions through multiple frameworks', async () => {
    const agent = new PhilosophyGeniusAgent();

    const result = await agent.ethics('Is it ethical to automate this decision?');

    expect(result.response).toContain('EthicalFrameworkTool');
    expect(result.response).toContain('consequentialism');
    expect(result.response).toContain('deontology');
  });

  it('orients philosophy timeline questions', async () => {
    const agent = new PhilosophyGeniusAgent();

    const result = await agent.ask('Give me a Stoicism timeline.');

    expect(result.response).toContain('PhilosophyTimelineTool');
    expect(result.response).toContain('Roman Stoa');
  });
});
