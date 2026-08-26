import { describe, expect, it, jest } from '@jest/globals';
import { WebSearcher } from '../WebSearcher';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-TOOL-001: WebSearcher Multi-Engine Search and Retrieval Suite', () => {
  it('searches DuckDuckGo and formats ToolResult', async () => {
    (mockedAxios.get as any).mockResolvedValueOnce({
      data: {
        AbstractText: 'TypeScript is a strongly typed programming language.',
        Heading: 'TypeScript',
        AbstractURL: 'https://typescriptlang.org',
        RelatedTopics: [
          { Text: 'TypeScript Handbook', FirstURL: 'https://typescriptlang.org/docs' }
        ]
      }
    });

    const searcher = new WebSearcher({}, 'duckduckgo');
    const result = await searcher.search('TypeScript', 5);

    expect(result.success).toBe(true);
    expect(result.data.results.length).toBeGreaterThan(0);
    expect(result.data.results[0].title).toBe('TypeScript');
  });

  it('searches Google Custom Search when configured', async () => {
    (mockedAxios.get as any).mockResolvedValueOnce({
      data: {
        items: [
          {
            title: 'Node.js Home',
            snippet: 'Node.js runtime',
            link: 'https://nodejs.org',
            displayLink: 'nodejs.org'
          }
        ]
      }
    });

    const searcher = new WebSearcher({ googleApiKey: 'g-key', googleCseId: 'cse-1' }, 'google');
    const result = await searcher.search('Node.js', 1);

    expect(result.success).toBe(true);
    expect(result.data.results[0].url).toBe('https://nodejs.org');
  });
});
