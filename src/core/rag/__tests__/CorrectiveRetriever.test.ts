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
});
