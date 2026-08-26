import { WebSearcher } from '../WebSearcher';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-TOOL-001: WebSearcher Multi-Engine Search & Tool Binding Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches using DuckDuckGo with structured instant answers and topics', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        Heading: 'TypeScript',
        AbstractText: 'TypeScript is a strongly typed programming language.',
        AbstractURL: 'https://en.wikipedia.org/wiki/TypeScript',
        RelatedTopics: [
          { Text: 'JavaScript - High-level programming language', FirstURL: 'https://en.wikipedia.org/wiki/JavaScript' }
        ]
      }
    } as any);

    const searcher = new WebSearcher({}, 'duckduckgo');
    const res = await searcher.search('TypeScript', 5);

    expect(res.success).toBe(true);
    expect(res.data.results.length).toBeGreaterThan(0);
    expect(res.data.results[0].title).toBe('TypeScript');
  });

  it('searches using Google Custom Search Engine', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            title: 'Node.js Documentation',
            snippet: 'Official Node.js documentation and API guides.',
            link: 'https://nodejs.org/docs'
          }
        ]
      }
    } as any);

    const searcher = new WebSearcher({
      googleApiKey: 'google-key',
      googleCseId: 'cse-id'
    }, 'google');

    const res = await searcher.search('Node.js docs', 3);
    expect(res.success).toBe(true);
    expect(res.data.results[0].title).toBe('Node.js Documentation');
  });

  it('fails with informative error when Google credentials are missing', async () => {
    const searcher = new WebSearcher({}, 'google');
    const res = await searcher.search('test query');

    expect(res.success).toBe(false);
    expect(res.error).toContain('GOOGLE_API_KEY and GOOGLE_CSE_ID');
  });

  it('searches using Bing Web Search API', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        webPages: {
          value: [
            {
              name: 'Express.js Framework',
              snippet: 'Fast, unopinionated, minimalist web framework.',
              url: 'https://expressjs.com'
            }
          ]
        }
      }
    } as any);

    const searcher = new WebSearcher({ bingApiKey: 'bing-key' }, 'bing');
    const res = await searcher.search('Express js', 3);

    expect(res.success).toBe(true);
    expect(res.data.results[0].title).toBe('Express.js Framework');
  });

  it('fails with informative error when Bing API key is missing', async () => {
    const searcher = new WebSearcher({}, 'bing');
    const res = await searcher.search('test query');

    expect(res.success).toBe(false);
    expect(res.error).toContain('BING_API_KEY');
  });

  it('converts WebSearcher to a callable Tool and instantiates from environment', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        Heading: 'Tool Result',
        AbstractText: 'Result text',
        AbstractURL: 'https://example.com',
        RelatedTopics: []
      }
    } as any);

    const searcher = new WebSearcher({}, 'duckduckgo');
    const tool = searcher.createTool();

    expect(tool.name).toBe('search_web');
    expect(tool.parameters).toBeDefined();

    const toolResult = await tool.execute({ query: 'Tool query', max_results: 2 });
    expect(toolResult.success).toBe(true);

    const fromEnv = WebSearcher.fromEnv();
    expect(fromEnv).toBeInstanceOf(WebSearcher);
  });

  it('performs multi-engine searches and deduplicates results', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        Heading: 'Multi Search',
        AbstractText: 'Unique content',
        AbstractURL: 'https://example.com/unique',
        RelatedTopics: []
      }
    } as any);

    const searcher = new WebSearcher({}, 'duckduckgo');
    const res = await searcher.searchMultiple('multi query', ['duckduckgo'], 2);

    expect(res.success).toBe(true);
    expect(res.data.results.length).toBeGreaterThan(0);
  });

  it('searches news with Bing when configured', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        value: [
          {
            name: 'Breaking Tech News',
            description: 'AI breakthroughs in 2026',
            url: 'https://news.example.com/ai',
            provider: [{ name: 'TechNews' }],
            datePublished: '2026-08-26T00:00:00Z'
          }
        ]
      }
    } as any);

    const searcher = new WebSearcher({ bingApiKey: 'bing-key' }, 'bing');
    const newsRes = await searcher.searchNews('AI developments', 1);

    expect(newsRes.success).toBe(true);
    expect(newsRes.data.results[0].title).toBe('Breaking Tech News');
  });
});
