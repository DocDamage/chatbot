export interface BacktestPoint {
  date: string;
  close: number;
}

export class BacktestRunner {
  run(points: BacktestPoint[]) {
    if (points.length < 2) {
      return { success: false, error: 'At least two price points are required for a backtest.' };
    }
    const start = points[0].close;
    const end = points[points.length - 1].close;
    const totalReturn = (end - start) / start;
    const peakDrawdown = points.reduce((state, point) => {
      const peak = Math.max(state.peak, point.close);
      return { peak, drawdown: Math.min(state.drawdown, (point.close - peak) / peak) };
    }, { peak: start, drawdown: 0 });
    return {
      success: true,
      totalReturn,
      maxDrawdown: Math.abs(peakDrawdown.drawdown),
      volatility: 0,
      sharpeRatio: 0,
      winRate: end >= start ? 1 : 0
    };
  }
}
