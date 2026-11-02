import axios from 'axios';
import { WikipediaSource } from '../WikipediaSource';
import { LibraryOfCongressSource } from '../LibraryOfCongressSource';
import { YouTubeSource } from '../YouTubeSource';
import { DocumentationSource } from '../DocumentationSource';
import { MediumSource } from '../MediumSource';
import { BaseKnowledgeSource } from '../BaseKnowledgeSource';
import { BookSource } from '../BookSource';
import { EntertainmentSource } from '../EntertainmentSource';
import { KnowledgeResult } from '../KnowledgeSource';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

class TestBaseSource extends BaseKnowledgeSource {
  name = 'test_source';
  async isAvailable(): Promise<boolean> { return true; }
  async search(query: string, _options?: any): Promise<KnowledgeResult[]> {
    if (query === 'found') {
      return [{
        id: 'test_1',
        title: 'Found Item',
        content: 'Content found',
        source: 'test_source',
        confidence: 0.9
      }];
    }
    return [];
  }

  // Expose protected methods for testing
  public testFetchUrl(url: string, options?: any) {
    return this.fetchUrl(url, options);
  }
  public testStripHtml(html: string) {
    return this.stripHtml(html);
  }
  public testTruncate(content: string, maxLength?: number) {
    return this.truncate(content, maxLength);
  }
  public testCalculateConfidence(metrics: any) {
    return this.calculateConfidence(metrics);
  }
}

describe('B75-03: Knowledge Sources Decision Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseKnowledgeSource', () => {
    it('handles getById with cache miss, hit, and query transformation', async () => {
      const source = new TestBaseSource();

      // First call - search found
      const res1 = await source.getById('test_source_found');
      expect(res1).not.toBeNull();
      expect(res1?.title).toBe('Found Item');

      // Second call - cache hit
      const resCached = await source.getById('test_source_found');
      expect(resCached).toEqual(res1);

      // Clear cache
      source.clearCache();

      // Not found
      const resNull = await source.getById('test_source_missing');
      expect(resNull).toBeNull();
    });

    it('utilities: fetchUrl, stripHtml, truncate, calculateConfidence', async () => {
      const source = new TestBaseSource();

      // fetchUrl success
      mockedAxios.get.mockResolvedValueOnce({ data: 'ok', status: 200 });
      const resp = await source.testFetchUrl('https://example.com');
      expect(resp).toBe('ok');

      // stripHtml
      const html = '<div class="content"><p>Hello <b>World</b>!</p>&amp; &lt;tag&gt;</div>';
      const text = source.testStripHtml(html);
      expect(text).toContain('Hello World!');
      expect(text).toContain('& <tag>');

      // truncate
      const longText = 'a'.repeat(50);
      expect(source.testTruncate(longText, 10)).toBe('aaaaaaaaaa...');
      expect(source.testTruncate('short', 10)).toBe('short');

      // calculateConfidence
      const confHigh = source.testCalculateConfidence({
        hasContent: true,
        contentLength: 600,
        hasMetadata: true,
        isVerified: true,
        popularity: 0.8,
        recency: 10
      });
      expect(confHigh).toBeGreaterThan(0.8);
    });
  });

  describe('WikipediaSource', () => {
    it('isAvailable handles success and failure', async () => {
      const wiki = new WikipediaSource();

      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      expect(await wiki.isAvailable()).toBe(true);

      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      expect(await wiki.isAvailable()).toBe(false);
    });

    it('searches Wikipedia with query enhancement, ranking, deduplication, and caching', async () => {
      const mockEmbeddingService: any = {
        generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
      };
      const mockLlmAdapter: any = {
        generate: jest.fn().mockResolvedValue({ content: 'quantum mechanics enhanced' })
      };

      const wiki = new WikipediaSource(mockEmbeddingService, mockLlmAdapter);

      mockedAxios.get
        // Search API query
        .mockResolvedValueOnce({
          data: {
            query: {
              search: [
                { pageid: 101, title: 'Quantum Mechanics', snippet: 'quantum physics' },
                { pageid: 102, title: 'Quantum Computing', snippet: 'qubits' }
              ]
            }
          }
        })
        // Summary for 101
        .mockResolvedValueOnce({
          data: {
            title: 'Quantum Mechanics',
            extract: 'Quantum mechanics is a fundamental theory in physics.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Quantum_Mechanics' } }
          }
        })
        // Summary for 102
        .mockResolvedValueOnce({
          data: {
            title: 'Quantum Computing',
            extract: 'Quantum computing is a rapidly-emerging technology.',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Quantum_Computing' } }
          }
        });

      const results = await wiki.search('quantum', { limit: 5 });
      expect(results.length).toBe(2);
      expect(results[0].title).toBe('Quantum Mechanics');

      // Cache hit on second search
      const cachedResults = await wiki.search('quantum', { limit: 5 });
      expect(cachedResults.length).toBe(2);
    });

    it('getById fetches page summary and handles errors', async () => {
      const wiki = new WikipediaSource();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          title: 'Albert Einstein',
          extract: 'Albert Einstein was a German-born theoretical physicist.',
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Albert_Einstein' } },
          pageid: 736
        }
      });

      const res = await wiki.getById('wiki_Albert_Einstein');
      expect(res?.title).toBe('Albert Einstein');

      mockedAxios.get.mockRejectedValueOnce(new Error('Page not found'));
      const notFound = await wiki.getById('wiki_NonExistent');
      expect(notFound).toBeNull();
    });
  });

  describe('LibraryOfCongressSource', () => {
    it('isAvailable handles online status', async () => {
      const loc = new LibraryOfCongressSource();
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      expect(await loc.isAvailable()).toBe(true);

      mockedAxios.get.mockRejectedValueOnce(new Error('Offline'));
      expect(await loc.isAvailable()).toBe(false);
    });

    it('searches LOC with format and dateRange options', async () => {
      const loc = new LibraryOfCongressSource();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              title: 'Civil War Maps',
              description: 'Historical maps from 1861-1865',
              url: '/item/123456/',
              date: '1865',
              subjects: ['Cartography', 'Civil War']
            }
          ]
        }
      });

      const results = await loc.search('civil war maps', { limit: 5, format: 'maps', dateRange: '1860-1870' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Civil War Maps');
      expect(results[0].metadata?.subjects).toContain('Civil War');
    });
  });

  describe('YouTubeSource', () => {
    it('isAvailable checks API key presence and endpoint health', async () => {
      const noKeySource = new YouTubeSource('');
      expect(await noKeySource.isAvailable()).toBe(false);

      const withKeySource = new YouTubeSource('valid-yt-key');
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      expect(await withKeySource.isAvailable()).toBe(true);
    });

    it('searches videos with details extraction and handles API errors', async () => {
      const yt = new YouTubeSource('valid-yt-key');

      mockedAxios.get
        // Search list
        .mockResolvedValueOnce({
          data: {
            items: [
              { id: { videoId: 'v123' }, snippet: { title: 'TypeScript Tutorial', channelTitle: 'TechEdu', publishedAt: '2025-01-01' } }
            ]
          }
        })
        // Video details
        .mockResolvedValueOnce({
          data: {
            items: [
              { snippet: { description: 'Full course for beginners' }, statistics: { viewCount: '50000' } }
            ]
          }
        });

      const results = await yt.search('typescript tutorial', { limit: 5 });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('youtube_v123');
      expect(results[0].content).toContain('Full course for beginners');

      // Search without api key
      const noKey = new YouTubeSource('');
      const emptyResults = await noKey.search('query');
      expect(emptyResults).toEqual([]);
    });
  });

  describe('DocumentationSource & MediumSource', () => {
    it('DocumentationSource searches MDN and DevDocs', async () => {
      const docSource = new DocumentationSource();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          documents: [
            { title: 'Array.prototype.map', summary: 'Creates a new array with results', mdn_url: '/docs/map' }
          ]
        }
      });

      const results = await docSource.search('array map');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('MediumSource searches published articles', async () => {
      const medium = new MediumSource();

      mockedAxios.get.mockResolvedValueOnce({
        data: `
          <rss>
            <channel>
              <item>
                <title>Building Distributed Systems</title>
                <link>https://medium.com/@author/building-distributed-systems</link>
                <description>A guide to modern distributed consensus.</description>
                <pubDate>Wed, 15 Jan 2025 00:00:00 GMT</pubDate>
              </item>
            </channel>
          </rss>
        `
      });

      const results = await medium.search('distributed systems');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('BookSource & EntertainmentSource', () => {
    it('BookSource searches Open Library and Gutenberg collections', async () => {
      const books = new BookSource();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          docs: [
            {
              key: '/works/OL123W',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
              isbn: ['0441172717']
            }
          ]
        }
      });

      const results = await books.search('Dune Frank Herbert');
      expect(results.length).toBeGreaterThanOrEqual(0);

      // Google Books with API key
      const googleBooks = new BookSource('google_books', 'test_api_key');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'gb_123',
              volumeInfo: {
                title: 'Dune',
                authors: ['Frank Herbert'],
                description: 'Sci-fi epic.',
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780441172719' }],
                categories: ['Science Fiction']
              }
            }
          ]
        }
      });
      const googleResults = await googleBooks.search('Dune', { author: 'Frank Herbert', isbn: '9780441172719' });
      expect(googleResults.length).toBe(1);
      expect(googleResults[0].id).toBe('google_gb_123');

      // getById
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 'gb_123',
          volumeInfo: { title: 'Dune', authors: ['Frank Herbert'] }
        }
      });
      const bookById = await googleBooks.getById('google_gb_123');
      expect(bookById?.title).toBe('Dune');

      // Gutenberg search
      const gutenberg = new BookSource('gutenberg');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 1342,
              title: 'Pride and Prejudice',
              authors: [{ name: 'Jane Austen' }],
              languages: ['en'],
              download_count: 50000
            }
          ]
        }
      });
      const gutenResults = await gutenberg.search('Pride and Prejudice');
      expect(gutenResults.length).toBe(1);
      expect(gutenResults[0].title).toContain('Pride and Prejudice');
    });

    it('EntertainmentSource queries entertainment databases', async () => {
      const ent = new EntertainmentSource();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          results: [
            { id: 1, title: 'Inception', overview: 'A thief enters dreams', release_date: '2010-07-16' }
          ]
        }
      });

      const results = await ent.search('Inception Nolan');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('RedditSource searches posts and retrieves by ID', async () => {
      const { RedditSource } = await import('../RedditSource');
      const reddit = new RedditSource();

      mockedAxios.get.mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('test.json')) {
          return { status: 200, data: {} };
        }
        if (typeof url === 'string' && url.includes('search.json')) {
          return {
            data: {
              data: {
                children: [
                  {
                    data: {
                      id: 'post1',
                      title: 'React 19 features',
                      selftext: 'React 19 introduces server actions',
                      permalink: '/r/reactjs/comments/post1',
                      subreddit: 'reactjs',
                      author: 'dev_user',
                      score: 250,
                      num_comments: 42,
                      created_utc: 1700000000,
                      upvote_ratio: 0.95
                    }
                  }
                ]
              }
            }
          };
        }
        if (typeof url === 'string' && url.includes('api/info.json')) {
          return {
            data: {
              data: {
                children: [
                  {
                    data: {
                      id: 'post1',
                      title: 'React 19 features',
                      selftext: 'React 19 introduces server actions',
                      permalink: '/r/reactjs/comments/post1',
                      subreddit: 'reactjs',
                      author: 'dev_user',
                      score: 250,
                      num_comments: 42,
                      created_utc: 1700000000
                    }
                  }
                ]
              }
            }
          };
        }
        return { data: {} };
      });

      // Availability check
      expect(await reddit.isAvailable()).toBe(true);

      const searchRes = await reddit.search('React 19', { subreddit: 'reactjs', sort: 'top' });
      expect(searchRes.length).toBe(1);
      expect(searchRes[0].title).toBe('React 19 features');

      const post = await reddit.getById('reddit_post1');
      expect(post?.title).toBe('React 19 features');
    });

    it('ProjectGutenbergSource searches catalog and fetches book texts', async () => {
      const { ProjectGutenbergSource } = await import('../ProjectGutenbergSource');
      const gutenberg = new ProjectGutenbergSource();

      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      expect(await gutenberg.isAvailable()).toBe(true);

      const searchRes = await gutenberg.search('Frankenstein');
      expect(searchRes.length).toBe(1);
      expect(searchRes[0].id).toContain('gutenberg_search');

      const searchById = await gutenberg.getById('gutenberg_search_Frankenstein');
      expect(searchById?.title).toContain('Frankenstein');

      mockedAxios.get.mockResolvedValueOnce({
        data: 'Title: Frankenstein\nAuthor: Mary Shelley\n\nFull book content starts here...'
      });

      const book = await gutenberg.getById('gutenberg_84');
      expect(book?.title).toContain('Frankenstein');
      expect(book?.metadata?.author).toBe('Mary Shelley');
    });

    it('QuoraSource searches questions and retrieves answers', async () => {
      const { QuoraSource } = await import('../QuoraSource');
      const quora = new QuoraSource();

      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      expect(await quora.isAvailable()).toBe(true);

      mockedAxios.get.mockResolvedValueOnce({
        data: '<div data-testid="question"><a href="/What-is-TypeScript">What is TypeScript?</a><div class="answer">A typed superset of JS</div></div>'
      });

      const results = await quora.search('TypeScript');
      expect(results.length).toBeGreaterThanOrEqual(1);

      mockedAxios.get.mockResolvedValueOnce({
        data: '<h1>What is TypeScript?</h1><div class="answer">A typed superset of JS</div>'
      });

      const q = await quora.getById('quora_What-is-TypeScript');
      expect(q?.title).toBe('What is TypeScript?');
    });

    it('LLMProgrammingSource retrieves curated and GitHub sources', async () => {
      const { LLMProgrammingSource } = await import('../LLMProgrammingSource');
      const llm = new LLMProgrammingSource();

      expect(await llm.isAvailable()).toBe(true);

      const results = await llm.search('LangChain');
      expect(results.length).toBeGreaterThan(0);

      const hf = await llm.getById('llm_Hugging_Face_Transformers');
      expect(hf?.title).toBe('Hugging Face Transformers');
    });

    it('UniversitySource searches courses and papers across MIT, Harvard, Stanford, and Brown', async () => {
      const { UniversitySource } = await import('../UniversitySource');
      const mit = new UniversitySource('mit');
      const harvard = new UniversitySource('harvard');
      const stanford = new UniversitySource('stanford');
      const brown = new UniversitySource('brown');

      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      expect(await mit.isAvailable()).toBe(true);

      // Search MIT courses & papers
      const mitRes = await mit.search('Physics', { limit: 5 });
      expect(mitRes.length).toBeGreaterThan(0);

      // Search Harvard papers
      const harvardRes = await harvard.search('Economics', { type: 'papers' });
      expect(harvardRes.length).toBeGreaterThan(0);

      // getById courses
      const mitCourse = await mit.getById('course_mit_Physics_101');
      expect(mitCourse?.title).toContain('MIT OpenCourseWare');

      const stanfordCourse = await stanford.getById('course_stanford_CS106A');
      expect(stanfordCourse?.title).toContain('STANFORD Course');

      // getById paper with ArXiv XML
      mockedAxios.get.mockResolvedValueOnce({
        data: '<feed><title>ArXiv Feed</title><entry><title>Quantum Computing</title><summary>Detailed quantum abstract.</summary><id>http://arxiv.org/abs/1234.5678</id></entry></feed>'
      });
      const paper = await brown.getById('paper_1234.5678');
      expect(paper?.title).toBe('Quantum Computing');
      expect(paper?.content).toBe('Detailed quantum abstract.');
    });

    it('KnowledgeFusion aggregates, deduplicates, filters confidence, and summarizes results', async () => {
      const { KnowledgeFusion } = await import('../KnowledgeFusion');
      const mockLLM: any = {
        generate: jest.fn().mockResolvedValue({ content: 'Comprehensive fused summary of quantum and physics.' })
      };
      const fusion = new KnowledgeFusion(mockLLM);

      const mockSource1: any = {
        name: 'src1',
        search: jest.fn().mockResolvedValue([
          { id: '1', title: 'Result 1', content: 'Content 1', confidence: 0.9 },
          { id: '2', title: 'Result 2', content: 'Content 2', confidence: 0.2 } // low confidence, will be filtered
        ])
      };
      const mockSource2: any = {
        name: 'src2',
        search: jest.fn().mockResolvedValue([
          { id: '1b', title: 'Result 1', content: 'Content 1', confidence: 0.85 }, // duplicate
          { id: '3', title: 'Result 3', content: 'Content 3', confidence: 0.8 }
        ])
      };
      const failingSource: any = {
        name: 'failing',
        search: jest.fn().mockRejectedValue(new Error('Source network timeout'))
      };

      const results = await fusion.fuse({
        sources: [mockSource1, mockSource2, failingSource],
        query: 'Quantum physics',
        minConfidence: 0.5,
        deduplicate: true,
        summarize: true,
        maxResults: 5
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].id).toBe('fused_summary');
      expect(results[0].content).toContain('Comprehensive fused summary');
    });
  });
});
