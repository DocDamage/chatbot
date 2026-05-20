import { GameDevGeniusAgent } from './GameDevGeniusAgent';

describe('GameDevGeniusAgent', () => {
  it('uses balance simulation for time-to-kill questions', async () => {
    const agent = new GameDevGeniusAgent();

    const result = await agent.answer('My enemy has 500 HP and the player does 20 damage every 0.5 seconds. Is that too tanky?');

    expect(result.intent.kind).toBe('balance');
    expect(result.toolResults[0].tool).toBe('BalanceSimTool');
    expect(result.response).toContain('time-to-kill');
    expect(result.response).toContain('12.5 seconds');
  });
});
