import { RAGRouter } from '../RAGRouter';

describe('B75-04: RAGRouter Deep Decision Matrix', () => {
  it('routes direct queries without database lookup', async () => {
    const mockRag = jest.fn().mockResolvedValue({ answer: 'RAG answer' });
    const router = new RAGRouter(mockRag);

    const res1 = await router.route('hello there');
    expect(res1.queryType).toBe('direct');
    expect(res1.sources).toEqual(['direct']);

    const res2 = await router.route('what time is it?');
    expect(res2.queryType).toBe('direct');

    const res3 = await router.route('thank you');
    expect(res3.queryType).toBe('direct');
  });

  it('routes SQL queries with sqlHandler and generates SQL query statements', async () => {
    const mockRag = jest.fn().mockResolvedValue({ answer: 'RAG answer' });
    const mockSql = jest.fn().mockResolvedValue([{ count: 42 }]);

    const router = new RAGRouter(mockRag, mockSql, undefined, {
      enableSQLRoute: true,
      sqlTables: ['users', 'orders', 'products']
    });

    const res = await router.route('how many users are registered? count of total orders');
    expect(res.queryType).toBe('sql');
    expect(res.sources).toEqual(['sql']);
    expect(mockSql).toHaveBeenCalled();
  });

  it('falls back to RAG when SQL query is classified but sqlHandler is absent', async () => {
    const mockRag = jest.fn().mockResolvedValue({ answer: 'RAG fallback answer' });
    const router = new RAGRouter(mockRag, undefined, undefined, { enableSQLRoute: true });

    const res = await router.route('how many items are in total? show all records where status is active');
    expect(res.queryType).toBe('sql');
    expect(res.sources).toEqual(['rag']);
    expect(mockRag).toHaveBeenCalled();
  });

  it('routes hybrid queries, executes both handlers, and merges results', async () => {
    const mockRag = jest.fn().mockResolvedValue({ answer: 'RAG explanation', sources: ['doc1'] });
    const mockSql = jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Alice' }] });

    const router = new RAGRouter(mockRag, mockSql, undefined, {
      enableHybridRoute: true
    });

    const res = await router.route('explain how many items exist');
    expect(res.queryType).toBe('hybrid');
    expect(res.sources).toContain('rag');
    expect(res.sources).toContain('sql');
    expect(mockRag).toHaveBeenCalled();
    expect(mockSql).toHaveBeenCalled();
  });

  it('uses LLM classifier when rules are inconclusive', async () => {
    const mockRag = jest.fn().mockResolvedValue({ answer: 'RAG response' });
    const mockSql = jest.fn().mockResolvedValue({ rows: [] });
    const mockLlm = jest.fn().mockResolvedValue(JSON.stringify({
      type: 'sql',
      confidence: 0.95,
      reasoning: 'Structured aggregation request'
    }));

    const router = new RAGRouter(mockRag, mockSql, mockLlm, {
      enableSQLRoute: true,
      sqlTables: ['metrics']
    });

    // Query that produces low rule confidence
    const res = await router.route('telemetry metrics aggregated for last quarter');
    expect(res.queryType).toBe('sql');
    expect(mockLlm).toHaveBeenCalled();
  });

  it('handles LLM classifier plain text and fallback parsing errors', async () => {
    const mockRag = jest.fn().mockResolvedValue({ answer: 'RAG response' });
    const mockLlmPlainText = jest.fn().mockResolvedValue('queryType: hybrid with confidence 0.9');

    const router = new RAGRouter(mockRag, undefined, mockLlmPlainText);
    const res = await router.route('uncertain ambiguous query that needs llm classification');
    expect(res.queryType).toBeDefined();

    // LLM throwing error
    const mockLlmError = jest.fn().mockRejectedValue(new Error('LLM unavailable'));
    const routerErr = new RAGRouter(mockRag, undefined, mockLlmError);
    const resErr = await routerErr.route('another ambiguous query');
    expect(resErr.queryType).toBeDefined();
  });
});
