import { createHash, randomUUID } from 'crypto';
import { Database } from '../database/Database';
import { logger } from '../observability/logger';
import { DocumentChunk } from '../../types/rag';

export interface SaveChunkOptions {
  runId?: string;
  sourceType?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
}

export interface RAGDocumentStoreStats {
  sources: number;
  chunks: number;
  embeddings: number;
}

export class RAGDocumentStore {
  constructor(private readonly database: Database) {}

  async saveChunks(chunks: DocumentChunk[], options: SaveChunkOptions = {}): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const sources = new Map<string, DocumentChunk[]>();
    for (const chunk of chunks) {
      const source = chunk.metadata.source || chunk.parentId || 'unknown';
      const existing = sources.get(source) || [];
      existing.push(chunk);
      sources.set(source, existing);
    }

    for (const [source, sourceChunks] of sources.entries()) {
      const sourceId = this.sourceId(source);
      const runId = options.runId || randomUUID();
      const metadata = {
        ...sourceChunks[0].metadata,
        persistedAt: new Date().toISOString()
      };

      await this.upsertSource(sourceId, source, sourceChunks[0], options.sourceType, metadata);
      await this.insertIngestionRun(runId, sourceId, sourceChunks.length, metadata);

      for (const chunk of sourceChunks) {
        await this.upsertChunk(chunk, sourceId, runId);

        if (chunk.embedding) {
          await this.upsertEmbedding(chunk, options);
        }
      }
    }

    logger.info('RAG chunks persisted', { chunksCount: chunks.length, sourcesCount: sources.size });
  }

  async loadChunks(): Promise<DocumentChunk[]> {
    const chunkRows = await this.database.query(`
      SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json
      FROM document_chunks dc
      LEFT JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
      ORDER BY dc.created_at ASC
    `);

    return chunkRows.rows.map(row => ({
      id: row.id,
      content: row.content,
      metadata: this.parseJson(row.metadata) || {},
      parentId: row.parent_id || undefined,
      embedding: row.embedding_json ? this.parseJson(row.embedding_json) : undefined
    }));
  }

  async getStats(): Promise<RAGDocumentStoreStats> {
    const [sources, chunks, embeddings] = await Promise.all([
      this.database.query('SELECT COUNT(*) AS count FROM knowledge_sources'),
      this.database.query('SELECT COUNT(*) AS count FROM document_chunks'),
      this.database.query('SELECT COUNT(*) AS count FROM chunk_embeddings')
    ]);

    return {
      sources: Number(sources.rows[0]?.count || 0),
      chunks: Number(chunks.rows[0]?.count || 0),
      embeddings: Number(embeddings.rows[0]?.count || 0)
    };
  }

  private async upsertSource(
    sourceId: string,
    source: string,
    chunk: DocumentChunk,
    sourceType: string | undefined,
    metadata: Record<string, any>
  ): Promise<void> {
    if (this.database.getType() === 'postgresql') {
      await this.database.query(
        `INSERT INTO knowledge_sources (id, source, source_type, title, content_hash, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           source = EXCLUDED.source,
           source_type = EXCLUDED.source_type,
           title = EXCLUDED.title,
           content_hash = EXCLUDED.content_hash,
           metadata = EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP`,
        [sourceId, source, sourceType || chunk.metadata.type || 'document', chunk.metadata.title || null, this.hash(source), JSON.stringify(metadata)]
      );
      return;
    }

    await this.database.query(
      `INSERT OR REPLACE INTO knowledge_sources (id, source, source_type, title, content_hash, metadata, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [sourceId, source, sourceType || chunk.metadata.type || 'document', chunk.metadata.title || null, this.hash(source), JSON.stringify(metadata)]
    );
  }

  private async insertIngestionRun(
    runId: string,
    sourceId: string,
    chunksCount: number,
    metadata: Record<string, any>
  ): Promise<void> {
    if (this.database.getType() === 'postgresql') {
      await this.database.query(
        `INSERT INTO ingestion_runs (id, source_id, status, chunks_count, metadata, completed_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           chunks_count = EXCLUDED.chunks_count,
           metadata = EXCLUDED.metadata,
           completed_at = CURRENT_TIMESTAMP`,
        [runId, sourceId, 'completed', chunksCount, JSON.stringify(metadata)]
      );
      return;
    }

    await this.database.query(
      `INSERT OR REPLACE INTO ingestion_runs (id, source_id, status, chunks_count, metadata, completed_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [runId, sourceId, 'completed', chunksCount, JSON.stringify(metadata)]
    );
  }

  private async upsertChunk(chunk: DocumentChunk, sourceId: string, runId: string): Promise<void> {
    const metadata = JSON.stringify(chunk.metadata);
    const tokenCount = chunk.content.split(/\s+/).filter(Boolean).length;

    if (this.database.getType() === 'postgresql') {
      await this.database.query(
        `INSERT INTO document_chunks (id, source_id, ingestion_run_id, content, chunk_index, token_count, metadata, parent_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           source_id = EXCLUDED.source_id,
           ingestion_run_id = EXCLUDED.ingestion_run_id,
           content = EXCLUDED.content,
           chunk_index = EXCLUDED.chunk_index,
           token_count = EXCLUDED.token_count,
           metadata = EXCLUDED.metadata,
           parent_id = EXCLUDED.parent_id,
           updated_at = CURRENT_TIMESTAMP`,
        [chunk.id, sourceId, runId, chunk.content, chunk.metadata.chunkIndex ?? null, tokenCount, metadata, chunk.parentId || null]
      );
      return;
    }

    await this.database.query(
      `INSERT OR REPLACE INTO document_chunks (id, source_id, ingestion_run_id, content, chunk_index, token_count, metadata, parent_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [chunk.id, sourceId, runId, chunk.content, chunk.metadata.chunkIndex ?? null, tokenCount, metadata, chunk.parentId || null]
    );
  }

  private async upsertEmbedding(chunk: DocumentChunk, options: SaveChunkOptions): Promise<void> {
    const embeddingJson = JSON.stringify(chunk.embedding);
    const dimensions = chunk.embedding?.length || 0;

    if (this.database.getType() === 'postgresql') {
      await this.database.query(
        `INSERT INTO chunk_embeddings (chunk_id, provider, model, dimensions, embedding_json, embedding_vector)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (chunk_id) DO UPDATE SET
           provider = EXCLUDED.provider,
           model = EXCLUDED.model,
           dimensions = EXCLUDED.dimensions,
           embedding_json = EXCLUDED.embedding_json,
           embedding_vector = EXCLUDED.embedding_vector`,
        [
          chunk.id,
          options.embeddingProvider || null,
          options.embeddingModel || null,
          dimensions,
          embeddingJson,
          this.toPgVector(chunk.embedding || [])
        ]
      );
      return;
    }

    await this.database.query(
      `INSERT OR REPLACE INTO chunk_embeddings (chunk_id, provider, model, dimensions, embedding_json)
       VALUES (?, ?, ?, ?, ?)`,
      [chunk.id, options.embeddingProvider || null, options.embeddingModel || null, dimensions, embeddingJson]
    );
  }

  private sourceId(source: string): string {
    return `source_${this.hash(source)}`;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private parseJson(value: unknown): any {
    if (!value) {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value;
    }

    return JSON.parse(value);
  }

  private toPgVector(embedding: number[]): string | null {
    if (embedding.length === 0) {
      return null;
    }

    return `[${embedding.join(',')}]`;
  }
}
