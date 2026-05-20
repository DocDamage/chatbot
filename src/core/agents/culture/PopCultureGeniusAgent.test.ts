import { PopCultureGeniusAgent } from './PopCultureGeniusAgent';

describe('PopCultureGeniusAgent', () => {
  it('answers 1995 prompts with a concrete pop culture reference', async () => {
    const agent = new PopCultureGeniusAgent();

    const result = await agent.ask('tell me something from 1995');

    expect(result.response).toContain('Toy Story');
    expect(result.response).toContain('1995');
    expect(result.response).toContain('Sources');
  });
});
