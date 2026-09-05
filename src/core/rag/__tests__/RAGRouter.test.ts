import { describe, expect, it, jest } from '@jest/globals';
import { RAGRouter } from '../RAGRouter';

describe('RT-RAG-001: RAGRouter Intent Classification and Multi-Route Suite', () => {
  it('classifies SQL aggregations and routes to SQL handler', async () => {
    const mockRag = jest.fn<any>().mockResolvedValue({ documents: [] });
    const mockSql = jest.fn<any>().mockResolvedValue({ rows: [{ count: 42 }] });

    const router = new RAGRouter(mockRag, mockSql, undefined, {
      enableSQLRoute: true,
      sqlTables: ['users', 'orders']
    });

    const classification = await router.classifyQuery('How many total orders where status is complete');
    expect(classification.queryType).toBe('sql');

    const result = await router.route('How many total orders where status is complete');
    expect(result.queryType).toBe('sql');
    expect(mockSql).toHaveBeenCalled();
  });

  it('classifies conceptual questions and routes to RAG handler', async () => {
    const mockRag = jest.fn<any>().mockResolvedValue({ documents: ['Doc 1'] });
    const mockSql = jest.fn<any>().mockResolvedValue({ rows: [] });

    const router = new RAGRouter(mockRag, mockSql);

    const classification = await router.classifyQuery('Explain how quantum entanglement works');
    expect(classification.queryType).toBe('rag');

    const result = await router.route('Explain how quantum entanglement works');
    expect(result.queryType).toBe('rag');
    expect(mockRag).toHaveBeenCalled();
  });

  it('uses LLM classifier when provided', async () => {
    const mockRag = jest.fn<any>().mockResolvedValue({ documents: [] });
    const mockSql = jest.fn<any>().mockResolvedValue({ rows: [] });
    const mockLLM = jest.fn<any>().mockResolvedValue(JSON.stringify({
      type: 'hybrid',
      confidence: 0.9,
      reasoning: 'Requires both structured metrics and unstructured docs'
    }));

    const router = new RAGRouter(mockRag, mockSql, mockLLM);
    const classification = await router.classifyQuery('Compare revenue against customer sentiment docs');
    expect(classification.queryType).toBe('hybrid');
    expect(classification.confidence).toBe(0.9);
  });
});
