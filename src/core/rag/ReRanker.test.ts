import { ReRanker } from './ReRanker';
import { MockLLMAdapter } from '../../__tests__/utils/test-helpers';
import { RetrievalResult } from '../../types/rag';

describe('ReRanker', () => {
  const results: RetrievalResult[] = [
    {
      chunk: {
        id: 'a',
        content: 'General notes about unrelated UI styling.',
        metadata: { source: 'ui.md' }
      },
      score: 0.4,
      retrievalMethod: 'keyword'
    },
    {
      chunk: {
        id: 'b',
        content: 'RAGDocumentStore persists chunks into document_chunks and chunk_embeddings.',
        metadata: { source: 'src/core/rag/RAGDocumentStore.ts' }
      },
      score: 0.3,
      retrievalMethod: 'keyword'
    }
  ];

  it('supports embedding reranking mode', async () => {
    const reranker = new ReRanker({ mode: 'embedding' });
    const reranked = await reranker.rerank('durable chunk_embeddings persistence', results, 2);

    expect(reranked[0].chunk.id).toBe('b');
  });

  it('supports LLM reranking mode with JSON chunk scores', async () => {
    const adapter = new MockLLMAdapter({
      'Rank these chunks': JSON.stringify({
        scores: [
          { chunkId: 'a', score: 0.2, reason: 'Unrelated' },
          { chunkId: 'b', score: 0.91, reason: 'Directly defines persistence behavior' }
        ]
      })
    });

    const reranker = new ReRanker({ mode: 'llm', llmAdapter: adapter });
    const reranked = await reranker.rerank('Where are RAG chunks persisted?', results, 2);

    expect(reranked[0].chunk.id).toBe('b');
    expect(reranked[0].chunk.metadata.rerankReason).toBe('Directly defines persistence behavior');
  });

  it('handles empty results and LLM failure fallback to heuristic', async () => {
    const reranker = new ReRanker();
    expect(await reranker.rerank('empty test', [], 5)).toEqual([]);

    const failingAdapter = new MockLLMAdapter({
      'Rank these chunks': 'INVALID_NON_JSON_RESPONSE'
    });
    const fallbackReranker = new ReRanker({ mode: 'llm', llmAdapter: failingAdapter });
    const fallbackResults = await fallbackReranker.rerank('persistence', results, 2);
    expect(fallbackResults.length).toBe(2);
  });

  it('evaluates heuristic cross encoder score across length, position, and metadata variations', async () => {
    const reranker = new ReRanker({ mode: 'heuristic' });

    const variedResults: RetrievalResult[] = [
      {
        chunk: {
          id: 'short',
          content: 'Short',
          metadata: { title: 'Query Exact Title Match', section: 'query term section' }
        },
        score: 0.1,
        retrievalMethod: 'keyword'
      },
      {
        chunk: {
          id: 'optimal',
          content: 'Query term starts immediately. '.repeat(15), // ~300 chars optimal
          metadata: {}
        },
        score: 0.5,
        retrievalMethod: 'keyword'
      },
      {
        chunk: {
          id: 'long',
          content: 'Unrelated long padding text. '.repeat(100), // >2000 chars
          metadata: {}
        },
        score: 0.2,
        retrievalMethod: 'keyword'
      }
    ];

    const ranked = await reranker.rerank('Query term', variedResults, 3);
    expect(ranked.length).toBe(3);
    expect(ranked[0].score).toBeGreaterThan(0);
  });
});
