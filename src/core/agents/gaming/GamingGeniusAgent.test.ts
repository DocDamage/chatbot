import { GamingGeniusAgent } from './GamingGeniusAgent';

describe('GamingGeniusAgent', () => {
  it('answers broad gaming questions without forcing them into gamedev only', async () => {
    const agent = new GamingGeniusAgent();
    const result = await agent.ask('How does speedrunning route planning work in Metroidvanias?');

    expect(result.mode).toBe('gaming');
    expect(result.intent.kind).toBe('speedrunning');
    expect(result.response).toContain('speedrunning');
    expect(result.response).toContain('Verification');
  });

  it('delegates implementation-style game development questions', async () => {
    const agent = new GamingGeniusAgent();
    const result = await agent.ask('Prototype a Godot platformer controller');

    expect(result.delegatedTo).toBe('gamedev');
    expect(result.response).toContain('Implementation plan');
  });
});
