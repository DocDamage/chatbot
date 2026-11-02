import { KnowledgeOnlineFlowService } from '../KnowledgeOnlineFlowService';
import { GitHubRepoKnowledgeImporter } from '../../importers/GitHubRepoKnowledgeImporter';
import { PyScrappyService } from '../../research/PyScrappyService';

describe('B75-08: Knowledge Online Flow, GitHub Importer, and PyScrappy Deep Matrix', () => {
  describe('KnowledgeOnlineFlowService Operations', () => {
    it('answers locally when confidence is high or triggers research when low', async () => {
      const mockRag = {
        processQuery: jest.fn().mockResolvedValue({
          answer: 'TypeScript is a typed superset of JavaScript.',
          confidence: 0.9,
          sources: ['ts-handbook']
        })
      };
      const mockOnlineKnowledge = {
        searchAndSummarize: jest.fn().mockResolvedValue({
          query: 'Quantum Computing',
          requiresApproval: true,
          sources: []
        }),
        ingestApproved: jest.fn().mockResolvedValue({
          ingestionId: 'ingest_1',
          saved: true
        })
      };

      const flow = new KnowledgeOnlineFlowService({
        ragService: mockRag as any,
        onlineKnowledgeService: mockOnlineKnowledge as any
      });

      // High confidence query
      const localResult = await flow.answerOrRequestResearch({ question: 'What is TypeScript?' });
      expect(localResult.needsOnlineResearch).toBe(false);
      expect(localResult.confidence).toBe(0.9);

      // Low confidence query
      mockRag.processQuery.mockResolvedValueOnce({
        answer: '',
        confidence: 0.2
      });
      const lowResult = await flow.answerOrRequestResearch({ question: 'Explain obscure theory' });
      expect(lowResult.needsOnlineResearch).toBe(true);
      expect(lowResult.miss).toBeDefined();

      // Search and ingest flow
      const searchRes = await flow.searchAndMaybeIngest({
        query: 'Frontier AI Architectures',
        approved: true,
        approvedBy: 'lead_dev'
      });
      expect(searchRes.ingested).toBe(true);
      expect(searchRes.ingestion.ingestionId).toBe('ingest_1');

      // Unapproved search
      const unapprovedRes = await flow.searchAndMaybeIngest({
        query: 'Frontier AI Architectures',
        approved: false
      });
      expect(unapprovedRes.ingested).toBe(false);

      // Estimate confidence with retrieved chunks and sources (without numeric confidence)
      mockRag.processQuery.mockResolvedValueOnce({
        answer: 'Partial answer',
        retrievedChunks: ['c1', 'c2', 'c3'],
        sources: ['s1', 's2']
      });
      const highChunkResult = await flow.answerOrRequestResearch({ question: 'Test chunks' });
      expect(highChunkResult.confidence).toBe(0.7);

      mockRag.processQuery.mockResolvedValueOnce({
        answer: 'Another answer',
        retrievedChunks: ['c1'],
        sources: []
      });
      const singleChunkResult = await flow.answerOrRequestResearch({ question: 'Test single chunk' });
      expect(singleChunkResult.confidence).toBe(0.5);

      mockRag.processQuery.mockResolvedValueOnce({
        answer: 'Plain answer without chunks'
      });
      const plainAnswerResult = await flow.answerOrRequestResearch({ question: 'Test plain answer' });
      expect(plainAnswerResult.confidence).toBe(0.35);

      // Throws on missing question or query
      await expect(flow.answerOrRequestResearch({ question: '' })).rejects.toThrow('question is required');
      await expect(flow.searchAndMaybeIngest({ query: '' })).rejects.toThrow('query is required');

      const flowNoOnline = new KnowledgeOnlineFlowService({});
      await expect(flowNoOnline.searchAndMaybeIngest({ query: 'hello' })).rejects.toThrow('Online knowledge service is required');
    });
  });

  describe('GitHubRepoKnowledgeImporter Operations', () => {
    it('fetches repo metadata, parses tree, generates wiki pages, and handles errors', async () => {
      const mockFetcher = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/git/trees/')) {
          return Promise.resolve({
            data: {
              tree: [
                { path: 'README.md', type: 'blob', size: 1024 },
                { path: 'src/index.ts', type: 'blob', size: 2048 }
              ]
            }
          });
        }
        if (url.includes('/readme')) {
          return Promise.resolve({
            data: {
              content: Buffer.from('# RepoCortex README').toString('base64')
            }
          });
        }
        if (url.includes('/repos/')) {
          return Promise.resolve({
            data: {
              name: 'RepoCortex',
              default_branch: 'main',
              topics: ['governance', 'code-intelligence'],
              language: 'TypeScript',
              license: { spdx_id: 'MIT' },
              description: 'Repo intelligence framework'
            }
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const mockWiki = {
        write: jest.fn().mockReturnValue({ slug: 'github/test/RepoCortex' })
      };

      const importer = new GitHubRepoKnowledgeImporter({
        fetcher: mockFetcher,
        wiki: mockWiki as any
      });

      const result = await importer.importRepo({
        owner: 'test',
        repo: 'RepoCortex',
        category: 'governance'
      });

      expect(result.repo).toBe('test/RepoCortex');
      expect(result.language).toBe('TypeScript');
      expect(result.files.length).toBe(2);
      expect(mockWiki.write).toHaveBeenCalled();
    });
  });

  describe('PyScrappyService Operations', () => {
    it('manages configuration from env, checks connection status, and closes gracefully', async () => {
      const service = new PyScrappyService();
      expect(service.isConfigured()).toBe(false);

      const status = await service.getStatus();
      expect(status.enabled).toBe(false);
      expect(status.connected).toBe(false);

      // Rejects invalid URLs
      const invalidHttp = await service.scrapeUrl('ftp://example.com/file.txt');
      expect(invalidHttp.success).toBe(false);
      expect(invalidHttp.error).toContain('HTTP');

      // Rejects private IP
      const privateIp = await service.scrapeUrl('http://127.0.0.1:8080/secret');
      expect(privateIp.success).toBe(false);
      expect(privateIp.error).toContain('Private');

      // Unconfigured scrape
      const unconfigured = await service.scrapeUrl('https://example.com/article');
      expect(unconfigured.success).toBe(false);
      expect(unconfigured.error).toContain('not configured');

      // createTool definition
      const toolDef = service.createTool();
      expect(toolDef.name).toBe('scrape_web_page');
      expect(toolDef.category).toBeDefined();

      // fromEnv
      process.env.PYSCRAPPY_ENABLED = 'true';
      process.env.PYSCRAPPY_MCP_ARGS = '["--port", "9000"]';
      const envService = PyScrappyService.fromEnv();
      expect(envService.isConfigured()).toBe(true);

      delete process.env.PYSCRAPPY_ENABLED;
      delete process.env.PYSCRAPPY_MCP_ARGS;

      service.close();
      expect(service.getStatus()).resolves.toBeDefined();
    });
  });
});
