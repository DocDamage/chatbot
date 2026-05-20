export class ValuationTool {
  peRatio(price: number, eps: number): number | null {
    return eps > 0 ? price / eps : null;
  }

  psRatio(marketCap: number, revenue: number): number | null {
    return revenue > 0 ? marketCap / revenue : null;
  }

  evEbitda(enterpriseValue: number, ebitda: number): number | null {
    return ebitda > 0 ? enterpriseValue / ebitda : null;
  }

  grossMargin(grossProfit: number, revenue: number): number | null {
    return revenue > 0 ? grossProfit / revenue : null;
  }

  freeCashFlowYield(freeCashFlow: number, marketCap: number): number | null {
    return marketCap > 0 ? freeCashFlow / marketCap : null;
  }

  growth(current: number, previous: number): number | null {
    return previous !== 0 ? (current - previous) / Math.abs(previous) : null;
  }

  debtToEquity(debt: number, equity: number): number | null {
    return equity > 0 ? debt / equity : null;
  }
}
