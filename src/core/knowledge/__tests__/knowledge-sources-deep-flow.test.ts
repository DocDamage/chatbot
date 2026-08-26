import { LocalKnowledgeAnswerer } from '../LocalKnowledgeAnswerer';
import { OnlineKnowledgeIngestionService } from '../OnlineKnowledgeIngestionService';
import { WikipediaSource } from '../WikipediaSource';
import { EntertainmentSource } from '../EntertainmentSource';

describe('B75-08: Local Knowledge Answerer, Ingestion, and Sources Deep Flow Matrix', () => {
  describe('LocalKnowledgeAnswerer Operations', () => {
    it('answers queries using search results or returns formatted knowledge miss', async () => {
      const mockStore = {
        searchKeyword: jest.fn().mockImplementation((query: string, options?: any) => {
          if (query.includes('quantum')) {
            return Promise.resolve([
              {
                chunk: {
                  id: 'chunk_1',
                  sourceId: 'src_1',
                  content: 'Quantum entanglement is a physical phenomenon occurring when pairs of particles interact.',
                  metadata: { title: 'Quantum Physics Guide', year: 2022, domain: 'science' }
                },
                score: 0.95
              }
            ]);
          }
          return Promise.resolve([]);
        })
      };

      const answerer = new LocalKnowledgeAnswerer(mockStore as any);

      // Hit path
      const answerHit = await answerer.answer('What happened in 1969 regarding Apollo?', 'history');
      expect(answerHit).toBeDefined();

      // Pop culture mode with broad fallback
      const popCultureAnswer = await answerer.answer('Who was the famous pop icon in 1982?', 'pop_culture');
      expect(popCultureAnswer).toBeDefined();

      // Science mode
      const scienceAnswer = await answerer.answer('What is quantum entanglement?', 'science');
      expect(scienceAnswer?.response).toContain('Quantum entanglement');
      expect(scienceAnswer?.model).toBe('local-knowledge-base');

      // Miss path
      const answerMiss = await answerer.answer('Unknown obscure query', 'history');
      expect(answerMiss?.knowledgeMiss).toBe(true);

      // No document store
      const noStoreAnswerer = new LocalKnowledgeAnswerer();
      const noStoreAnswer = await noStoreAnswerer.answer('Query', 'ask');
      expect(noStoreAnswer?.knowledgeMiss).toBe(true);
    });
  });

  describe('OnlineKnowledgeIngestionService Operations', () => {
    it('prepares previews, approves ingestion, and enforces content hashes', async () => {
      const mockDocManager = {
        addText: jest.fn().mockResolvedValue({ id: 'doc_1' }),
        deleteByMetadata: jest.fn().mockResolvedValue(1)
      };
      const mockSearcher = {
        searchWeb: jest.fn().mockResolvedValue([
          {
            title: 'AI 2026 Overview',
            url: 'https://example.com/ai-2026',
            snippet: 'Overview of latest breakthroughs in generative AI.'
          }
        ])
      };

      const ingestion = new OnlineKnowledgeIngestionService(mockDocManager as any, mockSearcher as any);

      const preview = await ingestion.searchAndSummarize('Artificial Intelligence Trends', 'technology');

      expect(preview.requiresApproval).toBe(true);
      expect(preview.sources.length).toBe(1);

      // Ingest without approval -> throws
      await expect(
        ingestion.ingestApproved(preview, { approved: false, approvedBy: 'reviewer' })
      ).rejects.toThrow();

      // Ingest with approval -> succeeds
      const result = await ingestion.ingestApproved(preview, { approved: true, approvedBy: 'lead_reviewer' });
      expect(result.ingestionId).toBeDefined();
      expect(mockDocManager.addText).toHaveBeenCalled();

      // Rollback ingestion
      const rollbackResult = await ingestion.rollbackIngestion(result.ingestionId);
      expect(rollbackResult.rolledBack).toBe(true);
      expect(rollbackResult.removed).toBeGreaterThanOrEqual(0);

      // Token tampering test
      const tampered = { ...preview, reviewToken: 'tampered-invalid-token' };
      await expect(
        ingestion.ingestApproved(tampered, { approved: true, approvedBy: 'lead_reviewer' })
      ).rejects.toThrow();

      // Deep research flow
      const deepPreview = await ingestion.deepResearch('Neural Networks', 'science');
      expect(deepPreview.researchType).toBe('deep-dive');
      expect(deepPreview.requiresApproval).toBe(true);
    });
  });

  describe('WikipediaSource and EntertainmentSource Operations', () => {
    it('handles Wikipedia source caching and query expansion options', async () => {
      const wiki = new WikipediaSource();
      const searchMock = jest.spyOn<any, any>(wiki, 'searchBase').mockResolvedValue([
        {
          id: 'wiki_1',
          title: 'Typescript',
          content: 'TypeScript is a strongly typed programming language.',
          url: 'https://en.wikipedia.org/wiki/TypeScript',
          source: 'wikipedia'
        }
      ]);

      const results1 = await wiki.search('TypeScript');
      expect(results1.length).toBe(1);

      // Second query should return cached result
      const results2 = await wiki.search('TypeScript');
      expect(results2.length).toBe(1);
      expect(searchMock).toHaveBeenCalledTimes(1);
    });

    it('searches entertainment sources with comics/manga fallback and handles unavailable API keys', async () => {
      const entertainment = new EntertainmentSource('all', undefined, undefined);
      expect(await entertainment.isAvailable()).toBe(false);

      const searchMangaSpy = jest.spyOn<any, any>(entertainment, 'searchManga').mockResolvedValue([
        {
          id: 'manga_1',
          title: 'Attack on Titan',
          content: 'Manga series by Hajime Isayama',
          source: 'entertainment'
        }
      ]);

      const results = await entertainment.search('Titan', { type: 'manga' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Attack on Titan');
    });
  });
});
