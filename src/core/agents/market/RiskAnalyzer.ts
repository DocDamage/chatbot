export class RiskAnalyzer {
  analyze(input: string): string[] {
    const text = input.toLowerCase();
    const risks = ['Equity prices can move sharply on earnings, rates, liquidity, and news.'];
    if (/\b(options?|calls?|puts?|expiring|0dte)\b/.test(text)) {
      risks.push('Options add expiration, volatility, liquidity, and total-loss risk.');
    }
    if (/\ball my money|life savings|all in\b/.test(text)) {
      risks.push('Concentrating all capital in one trade creates severe portfolio risk.');
    }
    return risks;
  }
}
