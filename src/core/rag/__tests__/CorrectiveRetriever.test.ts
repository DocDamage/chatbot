import { describe, expect, it, jest } from '@jest/globals';
import { CorrectiveRetriever } from '../CorrectiveRetriever';

describe('RT-RAG-003: CorrectiveRetriever CRAG Self-Correction Suite', () => {
  it('retrieves documents and verifies confidence score above threshold', async () => {
    const crag = new CorrectiveRetriever({ confidenceThreshold: 0.6 });

    const mockRetriever = {
      retrieve: jest.fn<any>().mockResolvedValue([
        { id: '1', content: 'Explain topic with detailed information and comprehensive architecture guide', score: 0.9 },
        { id: '2', content: 'Explain topic with secondary information and practical implementation patterns', score: 0.85 },
        { id: '3', content: 'Explain topic with third information and testing best practice examples', score: 0.8 }
      ])
    };

    crag.setRetriever(mockRetriever as any);

    const result = await crag.retrieve('Explain topic');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.iterations).toBe(1);
    expect(crag.getStats().configuredThreshold).toBe(0.6);
  });

  it('rewrites query using LLM adapter when initial retrieval has low confidence', async () => {
    const crag = new CorrectiveRetriever({
      confidenceThreshold: 0.8,
      maxIterations: 2,
      enableWebSearch: false
    });

    let callCount = 0;
    const mockRetriever = {
      retrieve: jest.fn<any>().mockImplementation(async (_q: string) => {
        callCount++;
        if (callCount === 1) {
          return [{ id: '1', content: 'Irrelevant snippet without keywords', score: 0.2 }];
        }
        return [
          {
            id: '2',
            content: 'Rewritten specific query with expanded terms - comprehensive architecture guide and detailed implementation',
            score: 0.95
          },
          {
            id: '3',
            content: 'Rewritten specific query with expanded terms - secondary verification patterns and operational metrics',
            score: 0.90
          },
          {
            id: '4',
            content: 'Rewritten specific query with expanded terms - tertiary documentation and performance characteristics',
            score: 0.88
          }
        ];
      })
    };

    const mockLLM = {
      process: jest.fn<any>().mockResolvedValue({
        content: 'Rewritten specific query with expanded terms'
      })
    };

    crag.setRetriever(mockRetriever as any);
    crag.setLLMAdapter(mockLLM);

    const result = await crag.retrieve('vague keyword');
    expect(result.corrections.length).toBeGreaterThan(0);
    expect(result.iterations).toBe(2);
    expect(mockLLM.process).toHaveBeenCalled();
  });

  it('handles web search augmentation strategy when confidence is very low', async () => {
    const crag = new CorrectiveRetriever({
      confidenceThreshold: 0.8,
      minDocuments: 3,
      enableWebSearch: true
    });

    const mockRetriever = {
      retrieve: jest.fn<any>().mockResolvedValue([])
    };

    crag.setRetriever(mockRetriever as any);

    // Mock webSearcher
    const mockWebSearcher = {
      search: jest.fn<any>().mockResolvedValue({
        success: true,
        data: {
          results: [{ title: 'Web Result', snippet: 'Web snippet content', url: 'https://example.com/web' }]
        }
      })
    };
    jest.spyOn(crag as any, 'webSearch').mockResolvedValueOnce([
      { id: 'web-0', content: 'Web Result\nWeb snippet content', score: 0.7, source: 'https://example.com/web' }
    ]);

    const result = await crag.retrieve('extremely obscure query not in database');
    expect(result).toBeDefined();
    expect(result.corrections).toContain('Augmented with web search');
    expect(result.documents.length).toBeGreaterThan(0);
  });

  it('integrates with ReRanker and handles null retriever gracefully', async () => {
    const cragNoRetriever = new CorrectiveRetriever();
    const emptyResult = await cragNoRetriever.retrieve('query with no retriever set');
    expect(emptyResult.documents).toEqual([]);
    expect(emptyResult.confidence).toBe(0);

    const cragWithReranker = new CorrectiveRetriever({ confidenceThreshold: 0.5 });
    const mockRetriever = {
      retrieve: jest.fn<any>().mockResolvedValue([
        { id: 'd1', content: 'Doc one content for reranking', score: 0.7 }
      ])
    };
    const mockReranker = {
      rerank: jest.fn<any>().mockResolvedValue([
        { id: 'd1', content: 'Doc one content for reranking', score: 0.95 }
      ])
    };

    cragWithReranker.setRetriever(mockRetriever as any);
    cragWithReranker.setReRanker(mockReranker as any);

    const rerankedResult = await cragWithReranker.retrieve('Doc one query');
    expect(rerankedResult.documents.length).toBe(1);
    expect(rerankedResult.confidence).toBeGreaterThan(0.5);
  });
});
