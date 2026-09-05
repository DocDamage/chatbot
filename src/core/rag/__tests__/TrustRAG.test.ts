import { describe, expect, it, jest } from '@jest/globals';
import { TrustRAG } from '../TrustRAG';

describe('RT-RAG-002: TrustRAG Confidence Scoring and Fallback Suite', () => {
  it('computes trust score and returns answer when confidence exceeds threshold', async () => {
    const mockRetriever = {
      search: jest.fn<any>().mockResolvedValue([
        { content: 'What is Node.js? Node.js runtime built on V8 architecture', source: 'docs/node.md', score: 0.95 },
        { content: 'What is Node.js? Node.js uses an event-driven architecture', source: 'docs/arch.md', score: 0.90 }
      ])
    };

    const mockLLM = jest.fn<any>().mockResolvedValue('Node.js is an event-driven JavaScript runtime built on Chrome V8.');

    const trustRag = new TrustRAG(mockRetriever, mockLLM, undefined, {
      minConfidence: 0.7,
      minSources: 2
    });

    const result = await trustRag.query('What is Node.js?');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.sources).toHaveLength(2);
    expect(result.fallbackUsed).toBe(false);
  });

  it('triggers web fallback when primary retriever yields low confidence or insufficient sources', async () => {
    const mockRetriever = {
      search: jest.fn<any>().mockResolvedValue([
        { content: 'Vague text', source: 'unknown.txt', score: 0.2 }
      ])
    };

    const mockWebSearch = jest.fn<any>().mockResolvedValue([
      { content: 'Authoritative web result from verified source', source: 'https://official.org', score: 0.95 },
      { content: 'Secondary web confirmation', source: 'https://reliable.edu', score: 0.90 }
    ]);

    const mockLLM = jest.fn<any>().mockResolvedValue('Answer generated from web fallback.');

    const trustRag = new TrustRAG(mockRetriever, mockLLM, mockWebSearch, {
      minConfidence: 0.8,
      enableWebFallback: true
    });

    const result = await trustRag.query('Obscure query');
    expect(result.fallbackUsed).toBe(true);
    expect(mockWebSearch).toHaveBeenCalled();
  });

  it('handles source validation failures, recency metadata, and generates warnings', async () => {
    const mockRetriever = {
      search: jest.fn<any>().mockResolvedValue([
        {
          content: 'Outdated document about legacy API version 1.0',
          source: 'docs/legacy.md',
          score: 0.4,
          metadata: { date: '2015-01-01' }
        },
        {
          content: 'Modern document about current API version 3.0',
          source: 'docs/modern.md',
          score: 0.9,
          metadata: { date: new Date().toISOString() }
        },
        {
          content: 'Contradictory noise with zero overlap',
          source: 'docs/noise.md',
          score: 0.1
        }
      ])
    };

    const mockLLM = jest.fn<any>().mockResolvedValue('Answer with source citations.');

    const trustRag = new TrustRAG(mockRetriever, mockLLM, undefined, {
      minConfidence: 0.9,
      minSources: 5,
      validateSources: true,
      enableWebFallback: false
    });

    const result = await trustRag.query('API version details');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.trustScore.recency).toBeGreaterThan(0);
    expect(result.trustScore.consistency).toBeDefined();
  });

  it('handles retriever and webSearcher failures gracefully', async () => {
    const failingRetriever = {
      search: jest.fn<any>().mockRejectedValue(new Error('Retriever database disconnected'))
    };
    const failingWebSearch = jest.fn<any>().mockRejectedValue(new Error('Web search rate limited'));
    const mockLLM = jest.fn<any>().mockResolvedValue('Fallback LLM output.');

    const trustRag = new TrustRAG(failingRetriever, mockLLM, failingWebSearch, {
      minConfidence: 0.8,
      enableWebFallback: true
    });

    const result = await trustRag.query('test question with failures');
    expect(result.sources).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
