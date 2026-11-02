import { SmartKnowledgeSource, SmartSourceOptions } from '../SmartKnowledgeSource';
import { KnowledgeResult } from '../KnowledgeSource';

class TestSmartSource extends SmartKnowledgeSource {
  name = 'test-smart-source';
  public mockResults: KnowledgeResult[] = [];

  constructor(options: SmartSourceOptions = {}) {
    super(options);
  }

  async searchBase(query: string, options?: any): Promise<KnowledgeResult[]> {
    if (query.includes('THROW_BASE_ERROR')) {
      throw new Error('Base search exploded');
    }
    return this.mockResults;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return this.mockResults.find(r => r.id === id) || null;
  }
}

describe('RT-KNOW-001: SmartKnowledgeSource Query Expansion, Semantic Ranking & Caching Suite', () => {
  it('executes smart search with basic query enhancement, confidence filtering, and caching', async () => {
    const source = new TestSmartSource({
      enableCaching: true,
      minConfidence: 0.6,
      maxResults: 5
    });

    source.mockResults = [
      { id: '1', title: 'Guide 1', content: 'content 1', source: 'kb', confidence: 0.8 },
      { id: '2', title: 'Guide 2', content: 'content 2', source: 'kb', confidence: 0.4 },
      { id: '3', title: 'Guide 3', content: 'content 3', source: 'kb', confidence: 0.9 }
    ];

    // Search for "how to best guide" (triggers basicQueryEnhancement synonyms)
    const results = await source.search('how to best guide');
    expect(results.length).toBe(2);
    expect(results.map(r => r.id)).toEqual(['1', '3']);

    // Second search hits cache
    const cached = await source.search('how to best guide');
    expect(cached.length).toBe(2);
  });

  it('uses LLM adapter to enhance query and handles query expansion disable and error', async () => {
    const mockLlm: any = {
      generate: jest.fn().mockResolvedValue({ content: 'expanded smart query' })
    };

    const source = new TestSmartSource({
      llmAdapter: mockLlm,
      enableQueryExpansion: true
    });

    source.mockResults = [{ id: '1', title: 'T', content: 'C', source: 'kb', confidence: 0.9 }];
    const res = await source.search('neural networks');

    expect(mockLlm.generate).toHaveBeenCalled();
    expect(res.length).toBe(1);

    // Disable expansion
    const disabledSource = new TestSmartSource({ enableQueryExpansion: false });
    disabledSource.mockResults = [{ id: '1', title: 'T', content: 'C', source: 'kb', confidence: 0.9 }];
    const resDisabled = await disabledSource.search('test');
    expect(resDisabled.length).toBe(1);

    // LLM error in enhanceQuery falls back to basic enhancement
    mockLlm.generate.mockRejectedValueOnce(new Error('LLM rate limit'));
    const resLlmError = await source.search('test');
    expect(resLlmError.length).toBe(1);
  });

  it('performs semantic ranking, handles vector errors, dimension mismatch, and empty results', async () => {
    const mockEmbeddingService: any = {
      generateEmbedding: jest.fn().mockImplementation((text: string) => {
        if (text.includes('FAIL_ITEM')) throw new Error('Item embedding failed');
        if (text.includes('apple')) return Promise.resolve([1, 0, 0]);
        if (text.includes('fruit')) return Promise.resolve([0.9, 0.1, 0]);
        return Promise.resolve([0, 1, 0]);
      })
    };

    const source = new TestSmartSource({
      embeddingService: mockEmbeddingService,
      enableSemanticRanking: true,
      minConfidence: 0.2
    });

    source.mockResults = [
      { id: '1', title: 'Vehicle', content: 'about cars', source: 'kb', confidence: 0.5 },
      { id: '2', title: 'Fruit', content: 'about apple and fruit', source: 'kb', confidence: 0.5 },
      { id: '3', title: 'Fail Item', content: 'about FAIL_ITEM', source: 'kb', confidence: 0.5 }
    ];

    const results = await source.search('apple');
    expect(results.length).toBe(3);
    expect(results[0].id).toBe('2');
    expect(results[0].confidence).toBeGreaterThan(results[1].confidence || 0);

    // Empty results semantic ranking
    const emptyRanked = await (source as any).semanticRanking('query', []);
    expect(emptyRanked).toEqual([]);

    // Cosine similarity dimension mismatch
    expect((source as any).cosineSimilarity([1, 2], [1])).toBe(0);

    // Entire semantic ranking failure
    mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(new Error('Global embedding crash'));
    const failedRank = await (source as any).semanticRanking('query', [{ id: '1', title: 't', content: 'c', confidence: 0.5 }]);
    expect(failedRank.length).toBe(1);
  });

  it('handles cross verification boosting and cache eviction of old entries', async () => {
    const source = new TestSmartSource({
      enableCrossVerification: true,
      enableCaching: true
    });

    source.mockResults = [
      { id: '1', title: 'Single source', content: 'c', source: 'kb', confidence: 0.5, metadata: { sources: ['src1'] } },
      { id: '2', title: 'Multi source', content: 'c', source: 'kb', confidence: 0.5, metadata: { sources: ['src1', 'src2'] } }
    ];

    const results = await source.search('test query');
    expect(results[1].confidence).toBe(0.6); // Boosted from 0.5 to 0.6

    // Populate cache with old/expired entries to test TTL eviction
    for (let i = 0; i < 105; i++) {
      (source as any).queryCache.set(`expired-${i}`, {
        results: [{ id: `${i}`, title: 't', content: 'c', source: 'kb', confidence: 0.8 }],
        timestamp: Date.now() - 4000000 // Expired > 1 hour
      });
    }
    (source as any).cacheResults('trigger-eviction', [{ id: 'new', title: 't', content: 'c', source: 'kb', confidence: 0.8 }]);
  });

  it('handles errors gracefully and falls back to base search', async () => {
    const source = new TestSmartSource({
      enableQueryExpansion: false
    });
    source.mockResults = [{ id: 'fallback', title: 'fb', content: 'fb', source: 'kb', confidence: 0.7 }];

    // Throw in semantic ranking or enhancement
    jest.spyOn(source as any, 'enhanceQuery').mockRejectedValueOnce(new Error('LLM crashed'));
    const results = await source.search('test query');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('fallback');
  });
});
