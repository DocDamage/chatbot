export class TechnicalIndicatorTool {
  sma(values: number[], period: number): number | null {
    if (period <= 0 || values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  }

  rsi(values: number[], period = 14): number | null {
    if (values.length <= period) return null;
    const changes = values.slice(1).map((value, index) => value - values[index]);
    const recent = changes.slice(-period);
    const gains = recent.filter(change => change > 0).reduce((sum, value) => sum + value, 0) / period;
    const losses = Math.abs(recent.filter(change => change < 0).reduce((sum, value) => sum + value, 0) / period);
    if (losses === 0) return 100;
    return 100 - (100 / (1 + gains / losses));
  }
}
