export class PortfolioAnalyzer {
  summarize(positions: Array<{ symbol: string; weight: number }>) {
    const concentration = positions.reduce((max, position) => Math.max(max, position.weight), 0);
    return {
      positions,
      concentration,
      warnings: concentration > 0.25 ? ['Largest position is above 25%; concentration risk may be high.'] : []
    };
  }
}
