import { ChronoKnowledgeEngine } from './ChronoKnowledgeEngine';

describe('ChronoKnowledgeEngine', () => {
  it('adds archaeological uncertainty for prehistory answers', async () => {
    const engine = new ChronoKnowledgeEngine();

    const result = await engine.ask({
      query: 'What kinds of evidence do we use for human history around 20000 BC?',
      domain: 'history',
      timeRange: { startYear: -20000, endYear: -19900 },
      includeTimeline: true,
      sourceMode: 'strict'
    });

    expect(result.answer).toContain('Dates are approximate and based on archaeological interpretation.');
    expect(result.evidenceQuality).toContain('archaeological');
    expect(result.timeline.length).toBeGreaterThan(0);
  });
});
