import { LocalKnowledgeAnswerer } from '../LocalKnowledgeAnswerer';
import { OnlineKnowledgeIngestionService } from '../OnlineKnowledgeIngestionService';
import { KnowledgeOnlineFlowService } from '../KnowledgeOnlineFlowService';

describe('B75-03: Knowledge Flow and Local Knowledge Answerer Decision Matrices', () => {
  describe('LocalKnowledgeAnswerer Advanced Branch Matrix', () => {
    it('handles BC millennium queries, ordinals, and specialized event lines', async () => {
      const store = {
        searchKeyword: jest.fn().mockImplementation(async (query: string) => {
          if (query.includes('2500') || query.includes('millennium') || query.includes('BC')) {
            return [{
              chunk: {
                id: 'bc-chunk-1',
                content: `== Events ==\n- Around 2500 BC – Construction of monuments.\n- January 15 – Minor incident.\n- Around 2500 BC – Construction of monuments with extra details extending line length significantly.`,
                metadata: {
                  source: 'history/ancient.md',
                  title: 'Ancient History',
                  chunkIndex: 0
                }
              },
              score: 0.95,
              retrievalMethod: 'keyword'
            }];
          }
          return [];
        })
      };

      const answerer = new LocalKnowledgeAnswerer(store as any);

      // 2500 BC query triggers millennium search & withThousandsComma
      const answer = await answerer.answer('What happened in 2500 BC?', 'history');
      expect(answer?.model).toBe('local-knowledge-base');
      expect(answer?.response).toContain('Construction of monuments');
    });

    it('scores weighted events (diana, hong kong, asian financial crisis, deep blue)', async () => {
      const store = {
        searchKeyword: jest.fn().mockResolvedValue([{
          chunk: {
            id: '1997-chunk',
            content: `## Events\n- July 1 – Hong Kong handover occurs.\n- August 31 – Princess Diana dies in Paris.\n- May 11 – Deep Blue defeats world champion Garry Kasparov.\n- July 2 – Asian financial crisis begins.`,
            metadata: {
              source: 'popculture/1997.md',
              title: '1997 Summary'
            }
          },
          score: 1,
          retrievalMethod: 'keyword'
        }])
      };

      const answerer = new LocalKnowledgeAnswerer(store as any);
      const answer = await answerer.answer('tell me the biggest story of 1997', 'pop_culture');
      expect(answer?.response).toContain('Princess Diana');
    });

    it('handles broad fallback when specialist search returns empty', async () => {
      let callCount = 0;
      const store = {
        searchKeyword: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount > 1) {
            return [{
              chunk: {
                id: 'broad-chunk',
                content: 'General knowledge information found in ask mode.',
                metadata: { source: 'general.md', title: 'General' }
              },
              score: 0.8,
              retrievalMethod: 'keyword'
            }];
          }
          return [];
        })
      };

      const answerer = new LocalKnowledgeAnswerer(store as any);
      const answer = await answerer.answer('explain quantum physics concepts', 'science');
      expect(answer).toBeDefined();
    });

    it('handles noLocalRecord with miss details and summary question formatting', async () => {
      // 1. Store returning empty
      const emptyStore = {
        searchKeyword: jest.fn().mockResolvedValue([])
      };
      const answerer = new LocalKnowledgeAnswerer(emptyStore as any);
      const noAnswer = await answerer.answer('Who was Napoleon in 1812?', 'history');
      expect(noAnswer?.knowledgeMiss).toBe(true);
      expect(noAnswer?.canSearchOnline).toBe(true);
      expect(noAnswer?.proposedWebQuery).toBeDefined();

      // 2. Summary question formatting lead
      const summaryStore = {
        searchKeyword: jest.fn().mockResolvedValue([{
          chunk: {
            id: 'sum-1',
            content: 'Section 1. Summary of overall development trends in science.\nSection 2. Key discoveries.',
            metadata: { domain: 'science', source: 'science/summary.md', title: 'Science Summary' }
          },
          score: 0.9,
          retrievalMethod: 'keyword'
        }])
      };
      const summaryAnswerer = new LocalKnowledgeAnswerer(summaryStore as any);
      const summaryAns = await summaryAnswerer.answer('Give me an overview summary of discoveries', 'science');
      expect(summaryAns?.response).toContain('From the local knowledge base');
    });
  });

  describe('OnlineKnowledgeIngestionService & KnowledgeOnlineFlowService', () => {
    it('handles ingestion status and dry run ingestion flow', async () => {
      const mockDocManager = {
        addText: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
        getStats: jest.fn().mockResolvedValue({ total: 10 })
      };

      const mockSearcher = {
        searchWeb: jest.fn().mockResolvedValue([
          { title: 'Web Page 1', snippet: 'Information snippet', url: 'https://example.com/1' }
        ])
      };

      const service = new OnlineKnowledgeIngestionService(mockDocManager as any, mockSearcher as any);
      const preview = await service.searchAndSummarize('test query');
      expect(preview.query).toBe('test query');

      const mockRagService = {
        processQuery: jest.fn().mockResolvedValue({
          answer: 'Confident local answer',
          confidence: 0.9,
          retrievedChunks: [{ id: 'c1' }]
        })
      };

      const flow = new KnowledgeOnlineFlowService({
        ragService: mockRagService,
        onlineKnowledgeService: service
      });

      const flowResult = await flow.answerOrRequestResearch({ question: 'What is quantum teleportation?' });
      expect(flowResult.answer).toBe('Confident local answer');
      expect(flowResult.needsOnlineResearch).toBe(false);
      expect(flowResult.confidence).toBe(0.9);

      // Low confidence triggers research requirement
      mockRagService.processQuery.mockResolvedValueOnce({
        answer: 'Uncertain answer',
        confidence: 0.2,
        retrievedChunks: []
      });

      const lowConfFlow = await flow.answerOrRequestResearch({ question: 'Unrecorded obscure concept' });
      expect(lowConfFlow.needsOnlineResearch).toBe(true);
    });
  });
});
