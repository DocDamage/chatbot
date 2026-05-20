import { GenericSpecialistAgent } from './GenericSpecialistAgent';

describe('GenericSpecialistAgent', () => {
  it('uses only same-domain knowledge chunks', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([
        {
          chunk: {
            id: 'wrong',
            content: 'Domain: sixsigma\nUnrelated process content.',
            metadata: { source: 'knowledge-base-public/sixsigma/overview.md' }
          },
          score: 1,
          retrievalMethod: 'keyword'
        },
        {
          chunk: {
            id: 'right',
            content: 'Domain: music\nMusic Production Genius covers original production guidance.',
            metadata: { source: 'knowledge-base-public/music/overview.md' }
          },
          score: 0.6,
          retrievalMethod: 'keyword'
        }
      ])
    };

    const agent = new GenericSpecialistAgent({
      id: 'music',
      label: 'Music Production Genius',
      guardrails: ['No copying.'],
      workflows: ['Classify music intent.'],
      tools: ['MixChecklistTool'],
      defaultSources: ['knowledge-base-public/music/overview.md']
    }, store as any);

    const result = await agent.ask('make a beat');

    expect(result.response).toContain('Music Production Genius');
    expect(result.sources).toEqual(['knowledge-base-public/music/overview.md']);
    expect(result.response).not.toContain('Unrelated process content');
  });
});
