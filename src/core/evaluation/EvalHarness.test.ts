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

  it('detects all failure modes: missing sources, missing terms, hallucinations, refusal errors, latency, and cost', async () => {
    const failingHarness = new EvalHarness(async () => ({
      answer: 'This answer mentions Pinecone and is incomplete.',
      sources: ['other/file.ts'],
      latencyMs: 350,
      cost: 0.15,
      refused: true
    }));

    const report = await failingHarness.runCases([
      {
        id: 'fail-001',
        query: 'Sample query',
        expected_sources: ['src/core/rag/RAGDocumentStore.ts'],
        must_contain: ['RequiredTerm'],
        must_not_contain: ['Pinecone'],
        answer_type: 'grounded',
        max_latency_ms: 100,
        max_cost: 0.05
      },
      {
        id: 'refusal-fail-002',
        query: 'Refusal query',
        answer_type: 'refusal'
      }
    ]);

    expect(report.total).toBe(2);
    expect(report.failed).toBe(1); // fail-001 fails multiple checks, refusal-fail-002 passes refusal because refused: true
    expect(report.results[0].failures).toContain('missing_expected_source');
    expect(report.results[0].failures).toContain('missing_required_answer_terms');
    expect(report.results[0].failures).toContain('contained_forbidden_terms');
    expect(report.results[0].failures).toContain('incorrect_refusal_behavior');
    expect(report.results[0].failures).toContain('latency_exceeded');
    expect(report.results[0].failures).toContain('cost_exceeded');
  });
});
