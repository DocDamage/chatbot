import { SpecialistIntent } from '../specialist/SpecialistAgent';

export class MarketIntentClassifier {
  classify(input: string): SpecialistIntent {
    const text = input.toLowerCase();
    if (/\b(backtest|strategy|cagr|sharpe|drawdown)\b/.test(text)) return { kind: 'backtest', confidence: 0.85 };
    if (/\b(filing|10-k|10-q|sec|risk factors)\b/.test(text)) return { kind: 'filing', confidence: 0.85 };
    if (/\b(fed|fred|cpi|unrate|gdp|treasury|macro)\b/.test(text)) return { kind: 'macro', confidence: 0.85 };
    if (/\b(portfolio|allocation|position|exposure)\b/.test(text)) return { kind: 'portfolio', confidence: 0.8 };
    if (/\b(risk|options|calls|puts|all my money|expiring)\b/.test(text)) return { kind: 'risk', confidence: 0.9 };
    if (/\b(pe|p\/e|valuation|revenue|margin|earnings)\b/.test(text)) return { kind: 'valuation', confidence: 0.8 };
    if (/\b(rsi|sma|moving average|technical)\b/.test(text)) return { kind: 'technical', confidence: 0.75 };
    return { kind: 'quote', confidence: 0.65 };
  }
}
