import { GenericSpecialistAgent } from '../specialists/GenericSpecialistAgent';
import { BusinessModelCanvasTool } from '../../tools/business/BusinessModelCanvasTool';
import { CompetitorResearchTool } from '../../tools/business/CompetitorResearchTool';
import { KpiDashboardTool } from '../../tools/business/KpiDashboardTool';
import { LeanCanvasTool } from '../../tools/business/LeanCanvasTool';
import { PricingModelTool } from '../../tools/business/PricingModelTool';
import { SwotTool } from '../../tools/business/SwotTool';
import { UnitEconomicsTool } from '../../tools/business/UnitEconomicsTool';

const profile = {
  id: "business",
  label: "Business / Product / Startup Genius",
  guardrails: [
    "Separate facts, assumptions, and recommendations.",
    "Call out uncertainty and missing data.",
    "Do not guarantee business outcomes."
  ],
  workflows: [
    "Classify strategy, pricing, market, operations, or unit economics.",
    "Retrieve market/Six Sigma/project context.",
    "Return assumptions, model, risks, and next actions."
  ],
  tools: [
    "BusinessModelCanvasTool",
    "SwotTool",
    "LeanCanvasTool",
    "PricingModelTool",
    "UnitEconomicsTool",
    "KpiDashboardTool",
    "CompetitorResearchTool"
  ],
  defaultSources: [
    "knowledge-base-public/business/overview.md"
  ]
};

export class BusinessGeniusAgent extends GenericSpecialistAgent {
  private businessModelCanvasTool = new BusinessModelCanvasTool();
  private swotTool = new SwotTool();
  private leanCanvasTool = new LeanCanvasTool();
  private pricingModelTool = new PricingModelTool();
  private unitEconomicsTool = new UnitEconomicsTool();
  private kpiDashboardTool = new KpiDashboardTool();
  private competitorResearchTool = new CompetitorResearchTool();

  constructor(documentStore?: any) {
    super(profile, documentStore);
  }

  override async ask(query: string, mode = 'ask') {
    const toolResponse = this.toolFirstResponse(query, mode);
    if (toolResponse) {
      return toolResponse;
    }

    return super.ask(query, mode);
  }

  plan(query: string) {
    return this.ask(query, 'plan');
  }

  pricing(query: string) {
    return this.ask(query, 'pricing');
  }

  market(query: string) {
    return this.ask(query, 'market');
  }

  unitEconomics(query: string) {
    return this.ask(query, 'unit-economics');
  }

  private toolFirstResponse(query: string, mode: string) {
    const text = query.toLowerCase();
    const results: Array<Record<string, any>> = [];

    if (mode === 'plan' || /\b(plan|strategy|business model|canvas|startup|launch)\b/.test(text)) {
      results.push(this.leanCanvasTool.run({ query, idea: query }));
      results.push(this.businessModelCanvasTool.run({ query, idea: query }));
      results.push(this.swotTool.run({ query, context: query }));
    }

    if (mode === 'pricing' || /\b(price|pricing|tier|subscription|charge|margin)\b/.test(text)) {
      results.push(this.pricingModelTool.run({
        monthlyCost: this.extractMoneyAfter(text, 'cost') || 0,
        targetMargin: this.extractPercentAfter(text, 'margin') || 0.8
      }));
    }

    if (mode === 'market' || /\b(market|competitor|competition|positioning|research)\b/.test(text)) {
      results.push(this.competitorResearchTool.run({ query, market: query }));
      results.push(this.swotTool.run({ query, context: query }));
    }

    if (mode === 'unit-economics' || /\b(unit economics|ltv|cac|arpu|churn|payback|gross margin)\b/.test(text)) {
      results.push(this.unitEconomicsTool.run({
        arpu: this.extractMoneyAfter(text, 'arpu') || this.extractMoneyAfter(text, 'price') || 0,
        cac: this.extractMoneyAfter(text, 'cac') || 0,
        churn: this.extractPercentAfter(text, 'churn') || 0,
        grossMargin: this.extractPercentAfter(text, 'gross margin') || this.extractPercentAfter(text, 'margin') || 0.8
      }));
    }

    if (/\b(kpi|metrics|dashboard|measure|retention|activation)\b/.test(text)) {
      results.push(this.kpiDashboardTool.run({ query, stage: text.includes('scale') ? 'scale' : 'early' }));
    }

    if (results.length === 0) {
      return undefined;
    }

    return {
      domain: 'business',
      mode,
      response: [
        `Business / Product / Startup Genius (${mode})`,
        '',
        `Request: ${query}`,
        '',
        'Business tool results:',
        ...results.map(result => `- ${result.tool}: ${JSON.stringify(result, null, 2)}`),
        '',
        'Guardrails:',
        ...profile.guardrails.map(rule => `- ${rule}`)
      ].join('\n'),
      sources: ['deterministic business tools'],
      guardrails: profile.guardrails,
      tools: results.map(result => String(result.tool || 'business-tool')),
      model: 'business-tools'
    };
  }

  private extractMoneyAfter(text: string, label: string): number | undefined {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`${escaped}[^0-9$]*(?:\\$)?(\\d+(?:\\.\\d+)?)`));
    return match ? Number(match[1]) : undefined;
  }

  private extractPercentAfter(text: string, label: string): number | undefined {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`${escaped}[^0-9]*(\\d+(?:\\.\\d+)?)\\s*%?`));
    if (!match) return undefined;
    const value = Number(match[1]);
    return value > 1 ? value / 100 : value;
  }
}
