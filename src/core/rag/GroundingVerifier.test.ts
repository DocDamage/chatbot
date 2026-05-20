import { GroundingVerifier } from './GroundingVerifier';
import { DocumentChunk } from '../../types/rag';

describe('GroundingVerifier', () => {
  const chunks: DocumentChunk[] = [{
    id: 'store-1',
    content: 'RAGDocumentStore persists document_chunks and chunk_embeddings for durable RAG.',
    metadata: { source: 'src/core/rag/RAGDocumentStore.ts' }
  }];

  it('marks answers grounded when claims are supported by retrieved chunks', () => {
    const result = GroundingVerifier.verify({
      answer: 'RAGDocumentStore persists document_chunks and chunk_embeddings.',
      retrievedChunks: chunks,
      requiredCitationCoverage: 0.8
    });

    expect(result.grounded).toBe(true);
    expect(result.coverage).toBeGreaterThanOrEqual(0.8);
    expect(result.unsupportedClaims).toHaveLength(0);
  });

  it('flags unsupported factual claims', () => {
    const result = GroundingVerifier.verify({
      answer: 'The project uses Pinecone for vector storage.',
      retrievedChunks: chunks,
      requiredCitationCoverage: 0.8
    });

    expect(result.grounded).toBe(false);
    expect(result.unsupportedClaims).toContain('The project uses Pinecone for vector storage.');
  });
});
