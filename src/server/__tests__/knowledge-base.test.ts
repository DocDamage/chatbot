/**
 * Integration tests for knowledge base endpoints
 */

import { RAGService } from '../../core/rag/RAGService';
import { DocumentManager } from '../../core/rag/DocumentManager';
import { MockLLMAdapter } from '../../__tests__/utils/test-helpers';
import { EmbeddingService } from '../../core/embeddings/EmbeddingService';

describe('Knowledge Base Integration', () => {
  let ragService: RAGService;
  let documentManager: DocumentManager;
  let mockAdapter: MockLLMAdapter;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    mockAdapter = new MockLLMAdapter();
    embeddingService = new EmbeddingService(undefined, undefined, 'xenova');
    ragService = new RAGService(mockAdapter, embeddingService);
    documentManager = new DocumentManager(ragService, embeddingService);
  });

  it('should add text to knowledge base', async () => {
    const chunks = await documentManager.addText(
      'This is test knowledge base content.',
      { source: 'test', title: 'Test Document' }
    );

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should retrieve information from knowledge base', async () => {
    await documentManager.addText(
      'The capital of France is Paris.',
      { source: 'geography', title: 'Geography Facts' }
    );

    mockAdapter.setResponse(
      'What is the capital',
      'Based on the knowledge base, the capital of France is Paris.'
    );

    const result = await ragService.processQuery('What is the capital of France?');
    expect(result).toHaveProperty('response');
  });
});

