/**
 * End-to-end test for knowledge base operations
 */

import { RAGService } from '../src/core/rag/RAGService';
import { DocumentManager } from '../src/core/rag/DocumentManager';
import { EmbeddingService } from '../src/core/embeddings/EmbeddingService';
import { MockLLMAdapter } from '../src/__tests__/utils/test-helpers';

describe('E2E Knowledge Base', () => {
  let ragService: RAGService;
  let documentManager: DocumentManager;
  let mockAdapter: MockLLMAdapter;
  let embeddingService: EmbeddingService;

  beforeAll(() => {
    mockAdapter = new MockLLMAdapter();
    embeddingService = new EmbeddingService(undefined, undefined, 'xenova');
    ragService = new RAGService(mockAdapter, embeddingService);
    documentManager = new DocumentManager(ragService, embeddingService);
  });

  it('should load documents and answer questions', async () => {
    // Add document
    await documentManager.addText(
      'Artificial Intelligence (AI) is the simulation of human intelligence by machines.',
      { source: 'ai-basics', title: 'AI Introduction' }
    );

    // Set up mock response
    mockAdapter.setResponse(
      'What is AI',
      'Based on the knowledge base, Artificial Intelligence (AI) is the simulation of human intelligence by machines.'
    );

    // Query
    const result = await ragService.processQuery('What is AI?');
    expect(result).toHaveProperty('response');
    expect(result.response).toContain('Artificial Intelligence');
  });

  it('should handle multiple documents', async () => {
    await documentManager.addText('Document 1 content', { source: 'doc1' });
    await documentManager.addText('Document 2 content', { source: 'doc2' });

    const stats = documentManager.getStats();
    expect(stats).toBeDefined();
  });
});

