import { BalanceSimTool } from './BalanceSimTool';

describe('BalanceSimTool', () => {
  it('calculates average time-to-kill from damage and attack cadence', () => {
    const tool = new BalanceSimTool();

    const result = tool.simulate({
      playerDamage: 20,
      enemyHp: 500,
      attackIntervalSeconds: 0.5
    });

    expect(result.averageTtkSeconds).toBe(12.5);
    expect(result.dps).toBe(40);
  });
});
