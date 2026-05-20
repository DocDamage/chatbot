import { PopCultureGeniusAgent } from './PopCultureGeniusAgent';

describe('PopCultureGeniusAgent', () => {
  it('keeps exact year facts out of the agent and delegates to source-backed metadata', async () => {
    const agent = new PopCultureGeniusAgent();

    const result = await agent.ask('tell me something from 1995');

    expect(result.response).toContain('1995');
    expect(result.response).toContain('Sources');
    expect(result.response).toContain('metadata for exact works');
  });
});
