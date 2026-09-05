import { ResultRanker } from '../ResultRanker';
import { ReasoningEngine } from '../ReasoningEngine';
import { KnowledgeFusion } from '../KnowledgeFusion';
import { KnowledgeResult, KnowledgeSource } from '../KnowledgeSource';

describe('B75-03: Knowledge Ranking, Reasoning, and Fusion Decision Matrices', () => {
  describe('ResultRanker', () => {
    it('ranks results with semantic similarity and multiple ranking factors', async () => {
      const mockEmbeddingService: any = {
        generateEmbedding: jest.fn().mockImplementation(async (text: string) => {
          if (text.includes('quantum')) return [1, 0, 0];
          return [0.5, 0.5, 0];
        })
      };

      const ranker = new ResultRanker(mockEmbeddingService);

      const now = new Date();
      const results: KnowledgeResult[] = [
        {
          id: 'res-today',
          title: 'Quantum computing today',
          content: 'A'.repeat(2500),
          source: 'wikipedia',
          url: 'https://en.wikipedia.org/wiki/Quantum',
          metadata: { publishedAt: new Date(now.getTime() - 1000 * 3600).toISOString(), verified: true },
          confidence: 0.9
        },
        {
          id: 'res-recent',
          title: 'Quantum overview',
          content: 'B'.repeat(1200),
          source: 'mdn',
          url: 'https://developer.mozilla.org/docs/quantum',
          metadata: { created: new Date(now.getTime() - 1000 * 3600 * 24 * 15).toISOString() },
          confidence: 0.8
        },
        {
          id: 'res-quarter',
          title: 'Quantum science paper',
          content: 'C'.repeat(600),
          source: 'custom_lab',
          url: 'https://university.edu/paper',
          metadata: { publishedAt: new Date(now.getTime() - 1000 * 3600 * 24 * 60).toISOString(), authority: true },
          confidence: 0.7
        },
        {
          id: 'res-year',
          title: 'Quantum notes',
          content: 'D'.repeat(200),
          source: 'custom_blog',
          url: 'https://example.com/blog',
          metadata: { publishedAt: new Date(now.getTime() - 1000 * 3600 * 24 * 200).toISOString() },
          confidence: 0.6
        },
        {
          id: 'res-old',
          title: 'Historical quantum',
          content: 'E'.repeat(50),
          source: 'unknown',
          metadata: { publishedAt: new Date(now.getTime() - 1000 * 3600 * 24 * 1000).toISOString() },
          confidence: 0.5
        },
        {
          id: 'res-very-old',
          title: 'Ancient post',
          content: 'F',
          source: 'unknown',
          metadata: { publishedAt: new Date(now.getTime() - 1000 * 3600 * 24 * 3000).toISOString() }
        },
        {
          id: 'res-no-date',
          title: 'No date doc',
          content: 'Short',
          source: 'unknown'
        }
      ];

      const ranked = await ranker.rank('quantum query', results, { semanticSimilarity: 0.5, recency: 0.2 });
      expect(ranked.length).toBe(7);
      expect(ranked[0].id).toBe('res-today');
      expect(ranked[0].confidence).toBeGreaterThan(0.7);

      // Empty results
      expect(await ranker.rank('query', [])).toEqual([]);

      // Ranker without embedding service
      const noEmbedRanker = new ResultRanker();
      const rankedFallback = await noEmbedRanker.rank('query', [results[0]]);
      expect(rankedFallback.length).toBe(1);
    });

    it('handles embedding service errors gracefully', async () => {
      const mockFailingEmbeddingService: any = {
        generateEmbedding: jest.fn().mockRejectedValue(new Error('Embedding service down'))
      };

      const ranker = new ResultRanker(mockFailingEmbeddingService);
      const results: KnowledgeResult[] = [{
        id: 'r1',
        title: 'Title',
        content: 'Content',
        source: 'test'
      }];

      const ranked = await ranker.rank('query', results);
      expect(ranked.length).toBe(1);
    });
  });

  describe('ReasoningEngine', () => {
    it('executes chainOfThought reasoning with conclusion detection and final answer', async () => {
      const mockLlm: any = {
        generate: jest.fn()
          // Step 1
          .mockResolvedValueOnce({ content: 'I need to check the prime factors of 12.' })
          // Step 2 with conclusion
          .mockResolvedValueOnce({ content: 'Conclusion: The prime factors of 12 are 2 and 3.' })
          // Final answer prompt
          .mockResolvedValueOnce({ content: 'The prime factors of 12 are 2 and 3.' })
      };

      const engine = new ReasoningEngine(mockLlm);
      const result = await engine.chainOfThought('What are the prime factors of 12?', 'Initial mathematical context', 5);

      expect(result.steps.length).toBe(2);
      expect(result.answer).toBe('The prime factors of 12 are 2 and 3.');
      expect(result.reasoningType).toBe('chain_of_thought');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('executes multiStepReasoning with tools and action extraction', async () => {
      const mockLlm: any = {
        generate: jest.fn()
          // Step 1 with tool call
          .mockResolvedValueOnce({ content: 'I will use calculator to compute 15 * 8.' })
          // Step 2 with conclusion
          .mockResolvedValueOnce({ content: 'Answer: 15 * 8 is 120.' })
          // Final answer
          .mockResolvedValueOnce({ content: '120' })
      };

      const engine = new ReasoningEngine(mockLlm);
      const result = await engine.multiStepReasoning('Compute 15 * 8', ['calculator', 'search'], 4);

      expect(result.steps.length).toBe(2);
      expect(result.steps[0].action).toBe('use_tool:calculator');
      expect(result.steps[1].action).toBe('conclude');
      expect(result.answer).toBe('120');
      expect(result.reasoningType).toBe('multi_agent');
    });
  });

  describe('KnowledgeFusion', () => {
    it('fuses, filters by confidence, deduplicates, and optionally summarizes results', async () => {
      const mockSource1: KnowledgeSource = {
        name: 'src1',
        isAvailable: async () => true,
        getById: jest.fn().mockResolvedValue(null),
        search: jest.fn().mockResolvedValue([
          { id: '1', title: 'Fusion Title 1', content: 'Content 1', source: 'src1', confidence: 0.9, url: 'https://example.com/1' },
          { id: '2', title: 'Low Conf', content: 'Low', source: 'src1', confidence: 0.2 }
        ])
      };

      const mockSource2: KnowledgeSource = {
        name: 'src2',
        isAvailable: async () => true,
        getById: jest.fn().mockResolvedValue(null),
        search: jest.fn().mockResolvedValue([
          { id: '1-dup', title: 'Fusion Title 1', content: 'Content 1', source: 'src2', confidence: 0.85, url: 'https://example.com/1' },
          { id: '3', title: 'Fusion Title 3', content: 'Content 3', source: 'src2', confidence: 0.8 }
        ])
      };

      const mockSource3Failing: KnowledgeSource = {
        name: 'src3',
        isAvailable: async () => true,
        getById: jest.fn().mockResolvedValue(null),
        search: jest.fn().mockRejectedValue(new Error('Source 3 failure'))
      };

      const mockLlm: any = {
        generate: jest.fn().mockResolvedValue({ content: 'Fused summary of information across sources.' })
      };

      const fusion = new KnowledgeFusion(mockLlm);
      const fused = await fusion.fuse({
        sources: [mockSource1, mockSource2, mockSource3Failing],
        query: 'fusion test',
        minConfidence: 0.5,
        deduplicate: true,
        summarize: true
      });

      // Filtered out low confidence (<0.5) and deduplicated by URL
      expect(fused.length).toBe(3); // 2 fused results + 1 summary result
      expect(fused[0].source).toBe('knowledge_fusion');
      expect(fused[0].content).toBe('Fused summary of information across sources.');
    });
  });
});
