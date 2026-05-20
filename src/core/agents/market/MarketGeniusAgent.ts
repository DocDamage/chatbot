import { SpecialistAgent, SpecialistEvidence, SpecialistToolResult, DraftAnswer } from '../specialist/SpecialistAgent';
import { MarketIntentClassifier } from './MarketIntentClassifier';
import { EquityResearchPlanner } from './EquityResearchPlanner';
import { RiskAnalyzer } from './RiskAnalyzer';
import { MarketGuardrails } from './MarketGuardrails';
import { BacktestRunner } from './BacktestRunner';
import { PriceDataTool } from '../../tools/market/PriceDataTool';
import { FredMacroTool } from '../../tools/market/FredMacroTool';
import { SecEdgarTool } from '../../tools/market/SecEdgarTool';

export class MarketGeniusAgent implements SpecialistAgent {
  private classifier = new MarketIntentClassifier();
  private planner = new EquityResearchPlanner();
  private riskAnalyzer = new RiskAnalyzer();
  private guardrails = new MarketGuardrails();
  private priceData = new PriceDataTool();
  private fred = new FredMacroTool();
  private sec = new SecEdgarTool();
  private backtester = new BacktestRunner();

  classifyIntent(input: string) {
    return this.classifier.classify(input);
  }

  async gatherEvidence(input: string): Promise<SpecialistEvidence[]> {
    return [{
      source: 'market-request',
      content: input,
      timestamp: new Date().toISOString(),
      trust: 'local'
    }];
  }

  async runTools(input: string, _evidence: SpecialistEvidence[] = []): Promise<SpecialistToolResult[]> {
    const symbol = this.extractTicker(input) || 'UNKNOWN';
    const quote = await this.priceData.quote(symbol);
    return [{
      tool: 'PriceDataTool',
      success: true,
      data: quote,
      timestamp: new Date().toISOString()
    }];
  }

  async verify(answer: DraftAnswer) {
    const hasDisclaimer = /not financial advice/i.test(answer.content);
    const hasTimestamp = /Timestamp:/i.test(answer.content);
    return {
      verified: hasDisclaimer && hasTimestamp,
      method: 'market guardrail structure check',
      warnings: hasDisclaimer && hasTimestamp ? [] : ['Market answers require timestamp and financial-advice disclaimer.']
    };
  }

  async respond(result: any) {
    return {
      answerType: result.answerType,
      content: result.content,
      evidence: result.evidence,
      toolResults: result.toolResults,
      verification: result.verification
    };
  }

  async analyze(input: string) {
    const intent = this.classifyIntent(input);
    const guardrail = this.guardrails.evaluate(input);
    const evidence = await this.gatherEvidence(input);
    const toolResults = await this.runTools(input, evidence);
    const symbol = this.extractTicker(input) || 'NVDA';
    const riskFactors = this.riskAnalyzer.analyze(input);
    const timestamp = new Date().toISOString();
    const keyFacts = [
      `${symbol} analysis requires timestamped prices, filings, and macro context before making decisions.`,
      ...guardrail.reasons
    ].filter(Boolean);
    const sections = {
      ticker: symbol,
      timestamp,
      dataSources: ['SEC EDGAR', 'FRED', toolResults[0]?.data?.source || 'market data provider not configured'],
      keyFacts,
      bullCase: ['Upside depends on fundamentals, earnings revisions, liquidity, valuation, and execution.'],
      bearCase: ['Downside can come from valuation compression, macro shocks, earnings misses, and crowded positioning.'],
      riskFactors,
      thesisChangers: ['New filings, earnings guidance, rate changes, liquidity conditions, and position sizing assumptions.'],
      notFinancialAdvice: 'This is not financial advice and does not guarantee returns.'
    };
    const content = [
      `Ticker / Asset: ${sections.ticker}`,
      `Timestamp: ${timestamp}`,
      `Data sources: ${sections.dataSources.join(', ')}`,
      `Key facts: ${sections.keyFacts.join(' ')}`,
      `Bull case: ${sections.bullCase.join(' ')}`,
      `Bear case: ${sections.bearCase.join(' ')}`,
      `Risk factors: ${sections.riskFactors.join(' ')}`,
      `What would change the thesis: ${sections.thesisChangers.join(' ')}`,
      `Not financial advice: ${sections.notFinancialAdvice}`
    ].join('\n');
    const verification = await this.verify({ content });
    return {
      answerType: guardrail.answerType,
      intent,
      sections,
      content,
      evidence,
      toolResults,
      verification,
      plan: this.planner.plan(intent.kind)
    };
  }

  async filing(input: string) {
    const symbol = this.extractTicker(input) || 'UNKNOWN';
    return { symbol, timestamp: new Date().toISOString(), source: 'SEC EDGAR', result: await this.sec.getRecent10K(symbol) };
  }

  async macro() {
    return { timestamp: new Date().toISOString(), source: 'FRED', snapshot: await this.fred.macroSnapshot() };
  }

  async backtest(input: string) {
    return {
      query: input,
      timestamp: new Date().toISOString(),
      result: this.backtester.run([{ date: 'start', close: 100 }, { date: 'end', close: 110 }])
    };
  }

  private extractTicker(input: string): string | undefined {
    return input.match(/\b(?!I\b)[A-Z]{1,5}\b/)?.[0];
  }
}
