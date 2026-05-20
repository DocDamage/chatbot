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
});
