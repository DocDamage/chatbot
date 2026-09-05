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
    expect(answer?.response).toContain('I do not have this in the local knowledge-base database');
    expect(answer?.knowledgeMiss).toBe(true);
    expect(answer?.canSearchOnline).toBe(true);
    expect(answer?.proposedWebQuery).toBe('tell me the biggest story of 1984');
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

  it('retrieves deep-research sources through related category tags', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'gaming-history-research-chunk-0',
          content: 'Video game history connects technical innovation with cultural change.',
          metadata: {
            source: 'online-research:gaming-history',
            title: 'Deep research: video game history',
            primaryCategory: 'gaming',
            categories: ['gaming', 'history', 'science'],
            relatedCategories: ['history', 'science']
          }
        },
        score: 0.8,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('how did technology shape video game history?', 'history');

    expect(answer?.response).toContain('technical innovation');
    expect(answer?.sources).toContain('online-research:gaming-history');
  });

  it('formats book-style answers as compact relevant passages instead of whole chunks', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'hobbit-chunk-0',
          content: [
            'THE HOBBIT THE HOBBIT OR THERE AND BACK AGAIN BY J.R.R. TOLKIEN Contents Title Page Chapter I: An Unexpected Party Chapter II: Roast Mutton.',
            'The Hobbit is a tale of high adventure, undertaken by a company of dwarves in search of dragon-guarded gold.',
            'A reluctant partner in this perilous quest is Bilbo Baggins, a comfort-loving hobbit who surprises even himself by his resourcefulness.'
          ].join(' '),
          metadata: {
            source: 'books/The Hobbit.epub',
            title: 'The Hobbit'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what happens in The Hobbit?', 'ask');

    expect(answer?.response).toContain('Closest local passages indicate');
    expect(answer?.response).toContain('Bilbo Baggins');
    expect(answer?.response).not.toContain('Contents Title Page');
    expect(answer?.response.length).toBeLessThan(900);
  });

  it('formats citations with readable book metadata while preserving raw source references', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'hobbit-citation-chunk-0',
          content: 'The Hobbit is about Bilbo Baggins joining a quest to reclaim treasure from a dragon.',
          metadata: {
            source: 'F:\\Downloads\\Books\\The Hobbit.epub',
            title: 'The Hobbit',
            author: 'J. R. R. Tolkien'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answerer = new LocalKnowledgeAnswerer(store as any);
    const answer = await answerer.answer('what is The Hobbit about?', 'ask');

    expect(answer?.response).toContain('- The Hobbit - J. R. R. Tolkien');
    expect(answer?.sources).toContain('F:\\Downloads\\Books\\The Hobbit.epub');
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

  it('attaches child events to standalone dates without merging the next date heading', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1979-structured-events',
          content: [
            '# 1979',
            'Domain: general',
            '## Events',
            '- June 15',
            '- A national restaurant chain introduced a new children\'s meal.',
            '- A thriller film was released by a major studio.',
            '- June 20 – A television news correspondent and his interpreter were killed; the news crew captured it on tape.',
            '- June 22',
            '- June 23 – A state premier opened a suburban railway.',
            '## Births'
          ].join('\n'),
          metadata: {
            source: 'fixtures/1979.md',
            title: '1979.md'
          }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };

    const answer = await new LocalKnowledgeAnswerer(store as any)
      .answer('tell me some news about 1979', 'ask');

    expect(answer?.response).toContain('June 20 – A television news correspondent');
    expect(answer?.response).toContain('June 23 – A state premier');
    expect(answer?.response).not.toMatch(/tape\.\s*[–-]\s*June 22/);
    expect(answer?.response).not.toMatch(/June 22\s*[–-]\s*June 23/);
  });

  it('returns richer defaults while honoring explicit brief and detailed requests', async () => {
    const eventLines = Array.from({ length: 16 }, (_, index) => {
      const month = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ][index % 12];
      return `- ${month} ${(index % 27) + 1} – Recorded event number ${index + 1} for the annual news timeline.`;
    });
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1979-answer-depth',
          content: ['# 1979', 'Domain: general', '## Events', ...eventLines, '## Births'].join('\n'),
          metadata: { source: 'fixtures/1979-depth.md', title: '1979.md' }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };
    const answerer = new LocalKnowledgeAnswerer(store as any);
    const countItems = (response = '') => response.match(/^\d+\./gm)?.length || 0;

    const standard = await answerer.answer('tell me some news about 1979', 'ask');
    const brief = await answerer.answer('give me a brief news summary about 1979', 'ask');
    const detailed = await answerer.answer('give me more detailed news about 1979', 'ask');

    expect(countItems(standard?.response)).toBe(10);
    expect(countItems(brief?.response)).toBe(5);
    expect(countItems(detailed?.response)).toBe(14);
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

    expect(answer?.response).toContain('I do not have this in the local knowledge-base database');
    expect(answer?.knowledgeMiss).toBe(true);
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
    expect(answer?.mode).toBe('ask');
    expect(answer?.model).toBe('local-knowledge-base');
  });

  it('does not use a generic year record for a music-industry question', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1997-general-chunk-0',
          content: 'Domain: general\n1997 was a common year with many events.',
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
    const answer = await answerer.answer('tell me about the music industry in 1997', 'pop_culture');
    expect(answer?.knowledgeMiss).toBe(true);
    expect(answer?.response).toContain('local pop culture database');
  });

  it('rejects an unrelated year match for a multi-word subject', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: '1997-geopolitics-chunk-0',
          content: '1997 edition. Hegemony of a New Type. The Eurasian Chessboard and the American global system.',
          metadata: {
            source: 'knowledge-base-public/general/geopolitics-1997.md',
            title: 'The Grand Chessboard'
          }
        },
        score: 0.95,
        retrievalMethod: 'keyword'
      }])
    };

    const answer = await new LocalKnowledgeAnswerer(store as any)
      .answer('what can you tell me about hip hop in 1997?', 'ask');

    expect(answer?.knowledgeMiss).toBe(true);
    expect(answer?.sources).toEqual([]);
  });

  it('requires a dated subject to appear near the requested year unless the source is year-specific', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'book-with-distant-year-and-topic',
          content: `Published in 1997. ${'unrelated branding commentary '.repeat(45)} Hip hop influenced fashion and youth marketing.`,
          metadata: {
            source: 'books/branding-study.pdf',
            title: 'A Study of Global Brands'
          }
        },
        score: 0.95,
        retrievalMethod: 'keyword'
      }])
    };

    const answer = await new LocalKnowledgeAnswerer(store as any)
      .answer('what can you tell me about hip hop in 1997?', 'ask');

    expect(answer?.knowledgeMiss).toBe(true);
  });

  it('rejects extracted dated-topic passages that omit the requested year', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'weak-dated-topic-answer',
          content: 'Published in 1997. Hip hop influenced fashion, branding, and youth marketing at the end of the decade.',
          metadata: {
            source: 'books/branding-study.pdf',
            title: 'A Study of Global Brands'
          }
        },
        score: 0.95,
        retrievalMethod: 'keyword'
      }])
    };

    const answer = await new LocalKnowledgeAnswerer(store as any)
      .answer('what can you tell me about hip hop in 1997?', 'ask');

    expect(answer?.knowledgeMiss).toBe(true);
  });

  it('rejects a year and subject that occur in separate factual entries', async () => {
    const store = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'dictionary-entries-with-unrelated-date',
          content: [
            'The composer later used diatonic writing influenced by jazz and popular music.',
            'Another musician studied at Juilliard from 1959 to 1962.',
            'Ernest Bloch died in Portland in 1959.'
          ].join('\n'),
          metadata: {
            source: 'books/Oxford Dictionary of Music.pdf',
            title: 'Oxford Dictionary of Music'
          }
        },
        score: 0.95,
        retrievalMethod: 'keyword'
      }])
    };

    const answer = await new LocalKnowledgeAnswerer(store as any)
      .answer('what can you tell me about jazz in 1959?', 'ask');

    expect(answer?.knowledgeMiss).toBe(true);
    expect(answer?.sources).toEqual([]);
  });

  it('handles empty document store constructor and passage extraction edge cases', async () => {
    const emptyAnswerer = new LocalKnowledgeAnswerer();
    const answer = await emptyAnswerer.answer('any query', 'ask');
    expect(answer?.knowledgeMiss).toBe(true);
    expect(answer?.canSearchOnline).toBe(true);

    const passageStore = {
      searchKeyword: jest.fn().mockResolvedValue([{
        chunk: {
          id: 'long-passage-chunk-0',
          content: '## Events\n- Event 1: Treaty signed.\n- Event 2: Battle ended.\n\n## Summary\nOverall peace was achieved across the continent.',
          metadata: { source: 'history/treaty.md', title: 'Treaty of 1800' }
        },
        score: 0.9,
        retrievalMethod: 'keyword'
      }])
    };
    const answerer = new LocalKnowledgeAnswerer(passageStore as any);
    const res = await answerer.answer('what events happened in 1800?', 'history');
    expect(res?.response).toContain('Treaty signed');
  });
});
