import { BusinessGeniusAgent } from './BusinessGeniusAgent';

describe('BusinessGeniusAgent', () => {
  it('builds startup plan canvases', async () => {
    const agent = new BusinessGeniusAgent();

    const result = await agent.plan('Build a plan for a chatbot startup.');

    expect(result.model).toBe('business-tools');
    expect(result.response).toContain('LeanCanvasTool');
    expect(result.response).toContain('BusinessModelCanvasTool');
    expect(result.response).toContain('SwotTool');
  });

  it('returns pricing model guidance', async () => {
    const agent = new BusinessGeniusAgent();

    const result = await agent.pricing('Pricing with cost 5 and margin 80%');

    expect(result.response).toContain('PricingModelTool');
    expect(result.response).toContain('Starter');
    expect(result.response).toContain('Pro');
  });

  it('calculates unit economics when inputs are present', async () => {
    const agent = new BusinessGeniusAgent();

    const result = await agent.unitEconomics('unit economics with ARPU 50 CAC 100 churn 5% gross margin 80%');

    expect(result.response).toContain('UnitEconomicsTool');
    expect(result.response).toContain('paybackMonths');
    expect(result.response).toContain('ltvToCac');
  });

  it('returns market research structure', async () => {
    const agent = new BusinessGeniusAgent();

    const result = await agent.market('Research competitors for an AI music tool.');

    expect(result.response).toContain('CompetitorResearchTool');
    expect(result.response).toContain('researchMatrix');
  });

  it('returns KPI dashboard when metrics are requested', async () => {
    const agent = new BusinessGeniusAgent();

    const result = await agent.ask('What KPIs should I track for activation and retention?');

    expect(result.response).toContain('KpiDashboardTool');
    expect(result.response).toContain('activation');
    expect(result.response).toContain('retention');
  });
});
