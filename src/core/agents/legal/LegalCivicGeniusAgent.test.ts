import { LegalCivicGeniusAgent } from './LegalCivicGeniusAgent';

describe('LegalCivicGeniusAgent', () => {
  it('explains contract clauses with jurisdiction and risk checks', async () => {
    const agent = new LegalCivicGeniusAgent();

    const result = await agent.contract('Explain this California indemnification clause.');

    expect(result.model).toBe('legal-tools');
    expect(result.response).toContain('JurisdictionRouterTool');
    expect(result.response).toContain('ContractClauseExplainerTool');
    expect(result.response).toContain('indemnification');
    expect(result.response).toContain('Not legal advice');
  });

  it('escalates high-stakes legal risk', async () => {
    const agent = new LegalCivicGeniusAgent();

    const result = await agent.risk('I was sued and have a court deadline.');

    expect(result.response).toContain('LegalRiskChecklistTool');
    expect(result.response).toContain('High-stakes issue detected');
  });

  it('routes civic process questions through statute/plain-English tools', async () => {
    const agent = new LegalCivicGeniusAgent();

    const result = await agent.civic('How do I request public records from a city agency?');

    expect(result.response).toContain('StatuteLookupTool');
    expect(result.response).toContain('PlainEnglishLegalTool');
    expect(result.response).toContain('official government');
  });

  it('structures case law summaries', async () => {
    const agent = new LegalCivicGeniusAgent();

    const result = await agent.ask('Summarize this case holding and precedent.');

    expect(result.response).toContain('CaseLawSummaryTool');
    expect(result.response).toContain('holding');
    expect(result.response).toContain('verify citator/status');
  });

  it('refuses specificity without jurisdiction by asking for jurisdiction', async () => {
    const agent = new LegalCivicGeniusAgent();

    const result = await agent.ask('Is this non-compete enforceable?');

    expect(result.response).toContain('JurisdictionRouterTool');
    expect(result.response).toContain('Ask for country/state/city');
  });
});
