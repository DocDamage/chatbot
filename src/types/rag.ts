/**
 * RAG System Types
 */

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    title?: string;
    author?: string;
    date?: Date;
    page?: number;
    section?: string;
    [key: string]: any;
  };
  embedding?: number[];
  parentId?: string; // For hierarchical chunking
  childrenIds?: string[];
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  retrievalMethod: 'bm25' | 'dense' | 'sparse' | 'hybrid';
}

export interface QueryExpansion {
  originalQuery: string;
  expandedQueries: string[];
  reasoning: string;
}

export interface CompressedContext {
  originalChunks: DocumentChunk[];
  compressedContent: string;
  compressionRatio: number;
  preservedChunks: DocumentChunk[];
}

export interface Citation {
  chunkId: string;
  source: string;
  content: string;
  relevance: number;
  metadata: Record<string, any>;
}

