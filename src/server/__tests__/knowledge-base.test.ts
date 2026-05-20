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

  it('assigns unique manual sources when text metadata has no source', async () => {
    const first = await documentManager.addText('First manual knowledge entry.');
    const second = await documentManager.addText('Second manual knowledge entry.');

    expect(first[0].metadata.source).toMatch(/^manual-/);
    expect(second[0].metadata.source).toMatch(/^manual-/);
    expect(first[0].metadata.source).not.toBe(second[0].metadata.source);
    expect(first[0].id).not.toBe(second[0].id);
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

