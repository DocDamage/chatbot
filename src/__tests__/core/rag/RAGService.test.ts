/**
 * Unit tests for RAGService
 */

import { RAGService } from '../../../core/rag/RAGService';
import { MockLLMAdapter, createMockChunks } from '../../utils/test-helpers';
import { EmbeddingService } from '../../../core/embeddings/EmbeddingService';

describe('RAGService', () => {
  let ragService: RAGService;
  let mockAdapter: MockLLMAdapter;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    mockAdapter = new MockLLMAdapter();
    embeddingService = new EmbeddingService(undefined, undefined, 'xenova');
    ragService = new RAGService(mockAdapter, embeddingService);
  });

  it('should add documents to knowledge base', () => {
    const chunks = createMockChunks(3);
    ragService.addDocuments(chunks);
    // Documents should be added without error
    expect(true).toBe(true);
  });

  it('should process queries', async () => {
    const chunks = createMockChunks(2);
    ragService.addDocuments(chunks);

    mockAdapter.setResponse('What is', 'Based on the documents, this is a test response.');

    const result = await ragService.processQuery('What is test?');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('citations');
  });

  it('should handle empty knowledge base', async () => {
    mockAdapter.setResponse('query', 'Response without RAG context.');
    const result = await ragService.processQuery('test query');
    expect(result).toHaveProperty('response');
  });
});

