import { EvalHarness } from './EvalHarness';

describe('EvalHarness', () => {
  it('grades must-contain, must-not-contain, source, latency, and hallucination checks', async () => {
    const harness = new EvalHarness(async () => ({
      answer: 'RAGDocumentStore writes document_chunks and chunk_embeddings.',
      sources: ['src/core/rag/RAGDocumentStore.ts'],
      latencyMs: 25,
      cost: 0,
      refused: false
    }));

    const report = await harness.runCases([{
      id: 'rag-001',
      query: 'What file handles durable RAG chunk storage?',
      expected_sources: ['src/core/rag/RAGDocumentStore.ts'],
      must_contain: ['RAGDocumentStore', 'document_chunks', 'chunk_embeddings'],
      must_not_contain: ['Pinecone'],
      answer_type: 'grounded',
      max_latency_ms: 100
    }]);

    expect(report.passed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.results[0]).toMatchObject({
      passed: true,
      retrievalPrecision: 1,
      answerCorrect: true,
      citationCorrect: true,
      hallucinationFree: true
    });
  });
});
