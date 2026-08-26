import { describe, expect, it } from '@jest/globals';
import { MarketGeniusAgent } from './MarketGeniusAgent';
import { MarketIntentClassifier } from './MarketIntentClassifier';

describe('RT-AGENT-MKT-001: MarketGeniusAgent and Market Intent Classifier Suite', () => {
  it('classifies backtest, filing, macro, portfolio, risk, valuation, technical, and quote intents', () => {
    const classifier = new MarketIntentClassifier();
    expect(classifier.classify('Run a backtest strategy to compute CAGR and drawdown').kind).toBe('backtest');
    expect(classifier.classify('Analyze SEC 10-K filing risk factors').kind).toBe('filing');
    expect(classifier.classify('Check Fed treasury rates and CPI macro data').kind).toBe('macro');
    expect(classifier.classify('Review my asset allocation portfolio exposure').kind).toBe('portfolio');
    expect(classifier.classify('Should I buy options calls expiring Friday?').kind).toBe('risk');
    expect(classifier.classify('Check price-to-earnings P/E valuation and margin').kind).toBe('valuation');
    expect(classifier.classify('Show 50-day moving average SMA and RSI technicals').kind).toBe('technical');
    expect(classifier.classify('AAPL price').kind).toBe('quote');
  });

  it('guardrails high-risk personalized options requests', async () => {
    const agent = new MarketGeniusAgent();

    const result = await agent.analyze('Should I put all my money into NVDA calls expiring Friday?');

    expect(result.answerType).toBe('guardrailed');
    expect(result.sections.notFinancialAdvice).toContain('not financial advice');
    expect(result.sections.riskFactors.join(' ').toLowerCase()).toContain('options');
    expect(result.sections.keyFacts.join(' ').toLowerCase()).not.toContain('guaranteed');
    expect(result.verification.verified).toBe(true);
  });

  it('retrieves filings, macro snapshots, and runs backtests', async () => {
    const agent = new MarketGeniusAgent();

    const filing = await agent.filing('AAPL 10-K');
    expect(filing.symbol).toBe('AAPL');
    expect(filing.source).toBe('SEC EDGAR');

    const macro = await agent.macro();
    expect(macro.source).toBe('FRED');
    expect(macro.snapshot).toBeDefined();

    const backtest = await agent.backtest('SMA crossover');
    expect(backtest.result).toBeDefined();
  });
});
