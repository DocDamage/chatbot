import { ValuationTool } from './ValuationTool';

export class FundamentalsTool extends ValuationTool {
  snapshot(input: Record<string, number>) {
    return {
      peRatio: this.peRatio(input.price, input.eps),
      psRatio: this.psRatio(input.marketCap, input.revenue),
      grossMargin: this.grossMargin(input.grossProfit, input.revenue),
      freeCashFlowYield: this.freeCashFlowYield(input.freeCashFlow, input.marketCap),
      debtToEquity: this.debtToEquity(input.debt, input.equity)
    };
  }
}
