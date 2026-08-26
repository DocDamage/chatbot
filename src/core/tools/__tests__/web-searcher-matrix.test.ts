import axios from 'axios';
import { WebSearcher } from '../WebSearcher';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('B75-07: WebSearcher Decision Matrix', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DuckDuckGo Engine', () => {
    it('handles instant answers, related topics, and subtopics', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          Heading: 'TypeScript',
          AbstractText: 'TypeScript is a strongly typed programming language.',
          AbstractURL: 'https://typescriptlang.org',
          RelatedTopics: [
            { Text: 'JavaScript - Language', FirstURL: 'https://js.org' },
            { Topics: [{ Text: 'Node.js - Runtime', FirstURL: 'https://nodejs.org' }] }
          ]
        }
      });

      const searcher = new WebSearcher({}, 'duckduckgo');
      const result = await searcher.search('TypeScript', 5);

      expect(result.success).toBe(true);
      expect(result.data?.results.length).toBeGreaterThanOrEqual(3);
      expect(result.data?.results[0].title).toBe('TypeScript');
    });

    it('falls back to HTML scraping when API results are fewer than requested', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: {} }) // Instant answer returns nothing
        .mockResolvedValueOnce({
          data: '<a class="result__a" href="https://example.com/item1">Item 1</a><a class="result__snippet">Snippet 1</a>'
        });

      const searcher = new WebSearcher({}, 'duckduckgo');
      const result = await searcher.search('rare query', 3);

      expect(result.success).toBe(true);
      expect(result.data?.results.length).toBe(1);
      expect(result.data?.results[0].url).toBe('https://example.com/item1');
    });
  });

  describe('Google Custom Search Engine', () => {
    it('throws when API key or CSE ID is missing', async () => {
      const searcher = new WebSearcher({}, 'google');
      const result = await searcher.search('query', 5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Google search requires API key');
    });

    it('executes Google search and maps results', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          items: [
            { title: 'GResult 1', snippet: 'GSnippet 1', link: 'https://google.com/1', displayLink: 'google.com' }
          ]
        }
      });

      const searcher = new WebSearcher({ googleApiKey: 'key1', googleCseId: 'cse1' }, 'google');
      const result = await searcher.search('query', 5);

      expect(result.success).toBe(true);
      expect(result.data?.results[0].title).toBe('GResult 1');
      expect(result.data?.results[0].source).toBe('Google');
    });

    it('handles 403 quota and 400 invalid config errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 403 } });
      const searcher = new WebSearcher({ googleApiKey: 'key1', googleCseId: 'cse1' }, 'google');
      const r1 = await searcher.search('q', 5);
      expect(r1.error).toContain('quota exceeded');

      mockedAxios.get.mockRejectedValueOnce({ response: { status: 400 } });
      const r2 = await searcher.search('q', 5);
      expect(r2.error).toContain('Invalid Google CSE configuration');
    });
  });

  describe('Bing Search Engine', () => {
    it('throws when Bing API key is missing', async () => {
      const searcher = new WebSearcher({}, 'bing');
      const result = await searcher.search('query', 5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bing search requires API key');
    });

    it('executes Bing search and news search', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          webPages: {
            value: [
              { name: 'BResult 1', snippet: 'BSnippet 1', url: 'https://bing.com/1', displayUrl: 'bing.com', dateLastCrawled: '2026-01-01' }
            ]
          }
        }
      });

      const searcher = new WebSearcher({ bingApiKey: 'bing_key' }, 'bing');
      const result = await searcher.search('query', 5);

      expect(result.success).toBe(true);
      expect(result.data?.results[0].title).toBe('BResult 1');
      expect(result.data?.results[0].source).toBe('Bing');

      // News Search
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          value: [
            { name: 'News 1', description: 'News Desc', url: 'https://news.com/1', datePublished: '2026-01-01', provider: [{ name: 'CNN' }] }
          ]
        }
      });
      const newsResult = await searcher.searchNews('breaking', 5);
      expect(newsResult.success).toBe(true);
      expect(newsResult.data?.results[0].source).toBe('CNN');
    });

    it('handles 401 invalid key and 403 quota errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
      const searcher = new WebSearcher({ bingApiKey: 'k' }, 'bing');
      const r1 = await searcher.search('q', 5);
      expect(r1.error).toContain('Invalid Bing API key');

      mockedAxios.get.mockRejectedValueOnce({ response: { status: 403 } });
      const r2 = await searcher.search('q', 5);
      expect(r2.error).toContain('Bing API quota exceeded');
    });
  });

  describe('Multi-engine Search and Factory Helpers', () => {
    it('executes searchMultiple and deduplicates identical URLs', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          Heading: 'Test',
          AbstractText: 'Test Snippet',
          AbstractURL: 'https://shared-url.com'
        }
      });

      const searcher = new WebSearcher({}, 'duckduckgo');
      const multi = await searcher.searchMultiple('test', ['duckduckgo'], 3);

      expect(multi.success).toBe(true);
      expect(multi.data?.results.length).toBe(1);
    });

    it('creates Tool definition and delegates execution', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { Heading: 'Tool Search', AbstractText: 'Found', AbstractURL: 'https://test.com' }
      });

      const searcher = new WebSearcher({}, 'duckduckgo');
      const tool = searcher.createTool();

      expect(tool.id).toBe('web_searcher');
      const res = await tool.execute({ query: 'Tool Search', max_results: 2 });
      expect(res.success).toBe(true);
    });

    it('instantiates from environment variables with priority selection', () => {
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_CSE_ID;
      delete process.env.BING_API_KEY;
      const s1 = WebSearcher.fromEnv();
      expect(s1).toBeDefined();

      process.env.GOOGLE_API_KEY = 'gkey';
      process.env.GOOGLE_CSE_ID = 'gcse';
      const s2 = WebSearcher.fromEnv();
      expect(s2).toBeDefined();

      delete process.env.GOOGLE_API_KEY;
      process.env.BING_API_KEY = 'bkey';
      const s3 = WebSearcher.fromEnv();
      expect(s3).toBeDefined();
    });
  });
});
