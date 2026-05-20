import { LocalKnowledgeAnswerer } from './LocalKnowledgeAnswerer';

describe('LocalKnowledgeAnswerer', () => {
  it('answers from local persisted chunks instead of a generic fallback', async () => {
    const store = {
      searchKeyword: jest.fn().mockImplementation(async (query: string) => {
        if (!query.includes('1996')) return [];
        return [{
          chunk: {
            id: 'popculture-1996-chunk-0',
            content: 'Domain: pop_culture\nYear: 1996\nThe biggest pop-culture story of 1996 was Tupac Shakur being killed.',
            metadata: {
              source: 'knowledge-base-public/popculture/1996.md',
              title: '1996.md'
            }
          },
          score: 1,
          retrievalMethod: 'keyword'
        }];
      })
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('tell me the biggest story of 1996', 'pop_culture');

    expect(answer?.model).toBe('local-knowledge-base');
    expect(answer?.response).toContain('From the local knowledge base');
    expect(answer?.response).toContain('Tupac Shakur');
    expect(answer?.response).not.toContain('connect an external model provider');
  });

  it('reports missing local records without using a generic template answer', async () => {
    const store = { searchKeyword: jest.fn().mockResolvedValue([]) };
    const answerer = new LocalKnowledgeAnswerer(store as any);

    const answer = await answerer.answer('tell me the biggest story of 1984', 'ask');

    expect(answer?.model).toBe('local-knowledge-base');
    expect(answer?.response).toContain('I do not have a matching knowledge-base record');
    expect(answer?.response).not.toContain('connect an external model provider');
  });

  it('can answer general ask-mode questions from any local chunk', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'sixsigma-cpk-chunk-0',
          content: 'Cpk measures process capability against specification limits using the nearest specification limit and process standard deviation.',
          metadata: {
            source: 'knowledge-base-public/sixsigma/six_sigma_tools.md',
            title: 'six_sigma_tools.md'
          }
        },
        score: 0.8,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what is cpk?', 'ask');

    expect(answer?.response).toContain('Cpk measures process capability');
    expect(answer?.sources).toContain('knowledge-base-public/sixsigma/six_sigma_tools.md');
  });

  it('answers year-event questions with events instead of the calendar summary', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1997-general-chunk-0',
          content: [
            '# 1997',
            'Domain: general',
            '## Summary',
            '1997 was a common year starting on Wednesday of the Gregorian calendar.',
            '',
            '## Events',
            '- March 9 - American rapper The Notorious B.I.G. is murdered in Los Angeles.',
            '- July 1 - Sovereignty over Hong Kong is transferred from the United Kingdom to China.',
            '- August 31 - Diana, Princess of Wales, dies in a car crash in Paris.',
            '- July 2 - The Asian financial crisis begins in Thailand.'
          ].join('\n'),
          metadata: {
            source: 'knowledge-base-public/general/wikipedia-summaries/1997.md',
            title: '1997.md'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what was the biggest thing to happen in 1997', 'ask');

    expect(answer?.response).toContain('strongest local-record candidates');
    expect(answer?.response).toContain('Diana');
    expect(answer?.response).toContain('Hong Kong');
    expect(answer?.response).not.toContain('common year starting on Wednesday');
  });

  it('does not answer an exact year query from unrelated chunks', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'sixsigma-unrelated-chunk-0',
          content: 'DMAIC project charters include goals, scope, timeline, team members, resources, and risks.',
          metadata: {
            source: 'knowledge-base-public/sixsigma/imported/blackbelt-knowledge-records.json',
            title: 'blackbelt-knowledge-records.json'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what do you know about 1821?', 'ask');

    expect(answer?.response).toContain('I do not have a matching knowledge-base record');
    expect(answer?.response).not.toContain('DMAIC project charters');
    expect(answer?.sources).toEqual([]);
  });

  it('answers older year records when the local source contains that year', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1821-general-chunk-0',
          content: [
            '# 1821',
            'Domain: general',
            '## Summary',
            '1821 was a common year.',
            '',
            '## Events',
            '- March 25 - Greece declares independence from the Ottoman Empire, beginning the Greek War of Independence.',
            '- July 28 - Peru declares independence from Spain.',
            '- September 27 - The Army of the Three Guarantees enters Mexico City, completing Mexican independence.'
          ].join('\n'),
          metadata: {
            source: 'knowledge-base-public/general/wikipedia-summaries/1821.md',
            title: '1821.md'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what do you know about 1821?', 'ask');

    expect(answer?.response).toContain('notable things that happened in 1821');
    expect(answer?.response).toContain('Greece');
    expect(answer?.response).toMatch(/Mexico|Central America|Gran Colombia|Peru/);
  });

  it('answers BCE prehistory records with approximate-date context', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '10000-bc-history-chunk-0',
          content: [
            '# 10000 BC',
            'Domain: history',
            '## Summary',
            '10000 BC falls in the 10th millennium BC. Dates this far back are approximate.',
            '',
            '## Events',
            '- Around 10000 BC - The world was warming after the last Ice Age, and glaciers were retreating in many regions.',
            '- Around 10000 BC - The transition toward settled life and early food production began in some regions.',
            '- Around 10000 BC - Natufian communities in the Levant supported sedentary or semi-sedentary settlements before full agriculture.'
          ].join('\n'),
          metadata: {
            source: 'knowledge-base-public/history/10000-bc.md',
            title: '10000-bc.md'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what do you know about 10000 BC?', 'ask');

    expect(answer?.response).toContain('notable things that happened in 10000 BC');
    expect(answer?.response).toContain('Around 10000 BC');
    expect(answer?.response).toContain('Ice Age');
    expect(answer?.sources).toContain('knowledge-base-public/history/10000-bc.md');
  });

  it('falls back to the broad corpus when a specialist domain has no matching source', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'ww1-general-chunk-0',
          content: 'Domain: general\nWorld War I was a global conflict that lasted from 1914 to 1918.',
          metadata: {
            source: 'knowledge-base-public/general/wikipedia-summaries/world-war-i.md',
            title: 'world-war-i.md'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what was world war i?', 'history');

    expect(answer?.response).toContain('World War I was a global conflict');
    expect(answer?.model).toBe('local-knowledge-base');
  });
});
