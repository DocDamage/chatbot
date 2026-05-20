import { GeoCultureGeniusAgent } from './GeoCultureGeniusAgent';

describe('GeoCultureGeniusAgent', () => {
  it('answers country profile questions with map context', async () => {
    const agent = new GeoCultureGeniusAgent();

    const result = await agent.country('Give me a country profile for Japan.');

    expect(result.model).toBe('geography-tools');
    expect(result.response).toContain('CountryProfileTool');
    expect(result.response).toContain('Tokyo');
    expect(result.response).toContain('MapLookupTool');
  });

  it('handles culture questions without flattening groups', async () => {
    const agent = new GeoCultureGeniusAgent();

    const result = await agent.culture('What etiquette matters for a business meeting?');

    expect(result.response).toContain('CulturalEtiquetteTool');
    expect(result.response).toContain('Avoid flattening groups');
    expect(result.response).toContain('business_etiquette');
  });

  it('flags contested map claims', async () => {
    const agent = new GeoCultureGeniusAgent();

    const result = await agent.mapContext('Explain this disputed border map.');

    expect(result.response).toContain('MapLookupTool');
    expect(result.response).toContain('contested or politically sensitive geography');
  });

  it('frames demographics with caveats', async () => {
    const agent = new GeoCultureGeniusAgent();

    const result = await agent.ask('Explain population, language, and urban demographics.');

    expect(result.response).toContain('DemographicsTool');
    expect(result.response).toContain('Census categories vary');
  });
});
