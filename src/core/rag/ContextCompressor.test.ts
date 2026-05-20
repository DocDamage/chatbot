import { ContextCompressor } from './ContextCompressor';
import { DocumentChunk } from '../../types/rag';

describe('ContextCompressor', () => {
  it('preserves chunk and source anchors in compressed context', async () => {
    const chunks: DocumentChunk[] = [{
      id: 'abc123',
      content: 'RAGService.processQuery handles retrieval and response generation.',
      metadata: { source: 'src/core/rag/RAGService.ts' }
    }];

    const compressor = new ContextCompressor(undefined, 2000);
    const result = await compressor.compress(chunks, 'How does RAG work?');

    expect(result.compressedContent).toContain('[chunk:abc123 source:src/core/rag/RAGService.ts]');
    expect(result.compressedContent).toContain('RAGService.processQuery');
  });
});
