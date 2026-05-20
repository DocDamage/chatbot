export interface BalanceSimInput {
  playerDamage: number | number[];
  enemyHp: number | number[];
  attackIntervalSeconds?: number;
  attackRate?: number;
  critChance?: number;
  critMultiplier?: number;
}

export class BalanceSimTool {
  simulate(input: BalanceSimInput) {
    const damage = this.average(input.playerDamage);
    const hp = this.average(input.enemyHp);
    const attacksPerSecond = input.attackRate || (input.attackIntervalSeconds ? 1 / input.attackIntervalSeconds : 1);
    const critMultiplier = input.critMultiplier || 2;
    const expectedCritFactor = 1 + ((input.critChance || 0) * (critMultiplier - 1));
    const dps = damage * attacksPerSecond * expectedCritFactor;
    const averageTtkSeconds = hp / dps;
    const difficultySpike = Array.isArray(input.enemyHp)
      ? Math.max(...input.enemyHp) / Math.max(1, Math.min(...input.enemyHp))
      : 1;

    return {
      averageTtkSeconds,
      dps,
      minTtkSeconds: Array.isArray(input.enemyHp) ? Math.min(...input.enemyHp) / dps : averageTtkSeconds,
      maxTtkSeconds: Array.isArray(input.enemyHp) ? Math.max(...input.enemyHp) / dps : averageTtkSeconds,
      difficultySpike,
      recommendedAdjustment: averageTtkSeconds > 10
        ? 'Consider lowering HP, increasing player damage, or adding vulnerability windows.'
        : 'TTK is within a responsive range for many action encounters.'
    };
  }

  private average(value: number | number[]): number {
    if (!Array.isArray(value)) return value;
    return value.reduce((sum, item) => sum + item, 0) / value.length;
  }
}
