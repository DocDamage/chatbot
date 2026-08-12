import { PopCultureGeniusAgent } from './PopCultureGeniusAgent';

describe('PopCultureGeniusAgent', () => {
  it('keeps exact year facts out of the agent and delegates to source-backed metadata', async () => {
    const agent = new PopCultureGeniusAgent();

    const result = await agent.ask('tell me something from 1995');

    expect(result.response).toContain('1995');
    expect(result.response).toContain('Sources');
    expect(result.response).toContain('metadata for exact works');
  });

  it('surfaces a useful, user-facing answer for music-industry history', async () => {
    const chrono = { ask: jest.fn() } as any;
    const agent = new PopCultureGeniusAgent(chrono);

    const result = await agent.ask('tell me about the music industry in 1997');

    expect(chrono.ask).not.toHaveBeenCalled();
    expect(result.answerType).toBe('historical_music_industry');
    expect(result.response).toContain('physical releases');
    expect(result.response).toContain('Spice Girls');
    expect(result.response).not.toContain('Era\n{');
  });
});
