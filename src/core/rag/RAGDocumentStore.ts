import { createHash, randomUUID } from 'crypto';
import { Database } from '../database/Database';
import { logger } from '../observability/logger';
import { DocumentChunk } from '../../types/rag';
import { RetrievalResult } from '../../types/rag';
import type { RetrievalFilters } from './HybridRetriever';

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

export interface KnowledgeSourceRecord {
  id: string;
  source: string;
  sourceType?: string;
  title: string;
  author?: string;
  publishedDate?: string;
  fileExtension?: string;
  citationLabel: string;
  chunks: number;
  embeddings: number;
  metadata: Record<string, any>;
  warnings: string[];
  needsOcr: boolean;
  emptyExtraction: boolean;
  duplicateKey?: string;
  duplicateCount: number;
  latestRun?: {
    id?: string;
    status?: string;
    chunksCount?: number;
    error?: string;
    completedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ListKnowledgeSourcesOptions {
  limit?: number;
  offset?: number;
  q?: string;
  needsOcr?: boolean;
  duplicatesOnly?: boolean;
  scanLimit?: number;
}

export interface KnowledgeSourceList {
  sources: KnowledgeSourceRecord[];
  total: number;
  limit: number;
  offset: number;
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

      await this.database.batchQuery([
        this.buildUpsertSourceQuery(sourceId, source, sourceChunks[0], options.sourceType, metadata),
        this.buildStartIngestionRunQuery(runId, sourceId, metadata),
        this.buildDeleteCitationsForSourceQuery(sourceId),
        this.buildDeleteEmbeddingsForSourceQuery(sourceId),
        this.buildDeleteChunksForSourceQuery(sourceId)
      ]);

      const persistenceBatchSize = this.persistenceBatchSize();
      for (let offset = 0; offset < sourceChunks.length; offset += persistenceBatchSize) {
        const persistenceQueries: Array<{ sql: string; params?: any[] }> = [];
        const chunkBatch = sourceChunks.slice(offset, offset + persistenceBatchSize);

        for (const chunk of chunkBatch) {
          persistenceQueries.push(this.buildUpsertChunkQuery(chunk, sourceId, runId));

          if (chunk.embedding) {
            persistenceQueries.push(this.buildUpsertEmbeddingQuery(chunk, options));
          }
        }

        await this.database.batchQuery(persistenceQueries);
      }

      await this.database.batchQuery([
        this.buildCompleteIngestionRunQuery(runId, sourceChunks.length, metadata)
      ]);
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

  async listSources(options: ListKnowledgeSourcesOptions = {}): Promise<KnowledgeSourceList> {
    const limit = this.clampPositiveInt(options.limit, 50, 1, 250);
    const offset = Math.max(0, Math.floor(Number(options.offset || 0)));
    const search = options.q?.trim().toLowerCase();
    const whereClauses: string[] = [];
    const params: any[] = [];
    const metadataTextSql = this.database.getType() === 'postgresql'
      ? 'LOWER(CAST(ks.metadata AS TEXT))'
      : `LOWER(COALESCE(ks.metadata, ''))`;

    if (search) {
      whereClauses.push(`(LOWER(COALESCE(ks.title, '')) LIKE ? OR LOWER(ks.source) LIKE ? OR ${metadataTextSql} LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (options.needsOcr === true) {
      whereClauses.push(`(LOWER(ks.source) LIKE '%.pdf' OR ${metadataTextSql} LIKE '%pdf%')`);
      whereClauses.push(`(${metadataTextSql} LIKE '%needsocr%' OR ${metadataTextSql} LIKE '%emptyextraction%' OR ${metadataTextSql} LIKE '%pdfocrstatus%' OR ${metadataTextSql} LIKE '%no extractable text%' OR ${metadataTextSql} LIKE '%pdf text extraction produced no text%')`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const requiresPostFilter = options.needsOcr !== undefined || options.duplicatesOnly === true;
    const dbLimit = requiresPostFilter
      ? this.clampPositiveInt(options.scanLimit, 10000, limit + offset, 50000)
      : limit;
    const dbOffset = requiresPostFilter ? 0 : offset;

    const rows = await this.database.query(
      `SELECT ks.id, ks.source, ks.source_type, ks.title, ks.metadata, ks.created_at, ks.updated_at,
              (
                SELECT COUNT(*)
                FROM document_chunks dc
                WHERE dc.source_id = ks.id
              ) AS chunks,
              (
                SELECT COUNT(*)
                FROM document_chunks dc
                JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
                WHERE dc.source_id = ks.id
              ) AS embeddings,
              (
                SELECT ir.id
                FROM ingestion_runs ir
                WHERE ir.source_id = ks.id
                ORDER BY COALESCE(ir.completed_at, ir.started_at) DESC
                LIMIT 1
              ) AS latest_run_id,
              (
                SELECT ir.status
                FROM ingestion_runs ir
                WHERE ir.source_id = ks.id
                ORDER BY COALESCE(ir.completed_at, ir.started_at) DESC
                LIMIT 1
              ) AS latest_run_status,
              (
                SELECT ir.chunks_count
                FROM ingestion_runs ir
                WHERE ir.source_id = ks.id
                ORDER BY COALESCE(ir.completed_at, ir.started_at) DESC
                LIMIT 1
              ) AS latest_run_chunks,
              (
                SELECT ir.error
                FROM ingestion_runs ir
                WHERE ir.source_id = ks.id
                ORDER BY COALESCE(ir.completed_at, ir.started_at) DESC
                LIMIT 1
              ) AS latest_run_error,
              (
                SELECT ir.completed_at
                FROM ingestion_runs ir
                WHERE ir.source_id = ks.id
                ORDER BY COALESCE(ir.completed_at, ir.started_at) DESC
                LIMIT 1
              ) AS latest_run_completed_at
       FROM (
         SELECT ks.id, ks.source, ks.source_type, ks.title, ks.metadata, ks.created_at, ks.updated_at
         FROM knowledge_sources ks
         ${whereSql}
         ORDER BY ks.updated_at DESC, ks.title ASC, ks.source ASC
         LIMIT ? OFFSET ?
       ) ks`,
      [...params, dbLimit, dbOffset]
    );

    const sources = rows.rows.map(row => this.rowToSourceRecord(row));
    this.annotateDuplicateSources(sources);

    const filtered = sources.filter(source => {
      if (options.needsOcr !== undefined && source.needsOcr !== options.needsOcr) {
        return false;
      }
      if (options.duplicatesOnly && source.duplicateCount <= 1) {
        return false;
      }
      return true;
    });

    if (requiresPostFilter) {
      return {
        sources: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset
      };
    }

    const total = await this.database.query(
      `SELECT COUNT(*) AS count
       FROM knowledge_sources ks
       ${whereSql}`,
      params
    );

    return {
      sources: filtered,
      total: Number(total.rows[0]?.count || filtered.length),
      limit,
      offset
    };
  }

  async getOcrQueue(options: Omit<ListKnowledgeSourcesOptions, 'needsOcr'> = {}): Promise<KnowledgeSourceList> {
    return this.listSources({
      ...options,
      needsOcr: true
    });
  }

  async hasSource(source: string): Promise<boolean> {
    const result = await this.database.query(
      `SELECT ks.id
       FROM knowledge_sources ks
       JOIN ingestion_runs ir ON ir.source_id = ks.id
        AND ir.status = 'completed'
       JOIN document_chunks dc ON dc.source_id = ks.id
        AND dc.ingestion_run_id = ir.id
       WHERE ks.source = ?
       LIMIT 1`,
      [source]
    );

    return result.rowCount > 0;
  }

  async searchKeyword(query: string, topK: number = 10, filters: RetrievalFilters = {}): Promise<RetrievalResult[]> {
    if (this.database.getType() === 'postgresql') {
      const result = await this.database.query(
        `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json,
                ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $1)) AS score
         FROM document_chunks dc
         LEFT JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
         WHERE to_tsvector('english', dc.content) @@ plainto_tsquery('english', $1)
         ORDER BY score DESC
         LIMIT $2`,
        [query, topK]
      );

      return result.rows.map(row => ({
        chunk: this.rowToChunk(row),
        score: Number(row.score || 0),
        retrievalMethod: 'keyword'
      })).filter(result => this.matchesFilters(result.chunk, filters));
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    try {
      return await this.searchKeywordSqliteFts(queryTokens, topK, filters);
    } catch (error: any) {
      logger.warn('SQLite FTS keyword search failed, using LIKE fallback', { error: error.message });
      return this.searchKeywordSqliteLike(queryTokens, topK, filters);
    }
  }

  async searchSimilar(queryEmbedding: number[], topK: number = 10, filters: RetrievalFilters = {}): Promise<RetrievalResult[]> {
    if (queryEmbedding.length === 0) {
      return [];
    }

    if (this.database.getType() === 'postgresql') {
      const result = await this.database.query(
        `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json,
                1 - (ce.embedding_vector <=> $1) AS score
         FROM document_chunks dc
         JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
         WHERE ce.embedding_vector IS NOT NULL
         ORDER BY ce.embedding_vector <=> $1
         LIMIT $2`,
        [this.toPgVector(queryEmbedding), topK]
      );

      return result.rows.map(row => ({
        chunk: this.rowToChunk(row),
        score: Number(row.score || 0),
        retrievalMethod: 'vector'
      })).filter(result => this.matchesFilters(result.chunk, filters));
    }

    return this.searchSimilarSqlite(queryEmbedding, topK, filters);
  }

  async hybridSearch(
    query: string,
    queryEmbedding?: number[],
    topK: number = 10,
    filters: RetrievalFilters = {}
  ): Promise<RetrievalResult[]> {
    if (this.database.getType() === 'sqlite') {
      const keywordPoolSize = Math.max(topK * 2, this.sqliteKeywordCandidateLimit());
      const keywordResults = await this.searchKeyword(query, keywordPoolSize, filters);
      const candidateIds = keywordResults.map(result => result.chunk.id);
      const vectorResults = queryEmbedding && candidateIds.length > 0
        ? await this.searchSimilarSqlite(queryEmbedding, Math.max(topK * 2, candidateIds.length), filters, candidateIds)
        : queryEmbedding && this.sqliteFullVectorScanEnabled()
          ? await this.searchSimilarSqlite(queryEmbedding, topK * 2, filters)
          : [];

      return this.mergeSearchResults(keywordResults, vectorResults, topK);
    }

    const [keywordResults, vectorResults] = await Promise.all([
      this.searchKeyword(query, topK * 2, filters),
      queryEmbedding ? this.searchSimilar(queryEmbedding, topK * 2, filters) : Promise.resolve([])
    ]);

    return this.mergeSearchResults(keywordResults, vectorResults, topK);
  }

  private mergeSearchResults(
    keywordResults: RetrievalResult[],
    vectorResults: RetrievalResult[],
    topK: number
  ): RetrievalResult[] {
    const merged = new Map<string, RetrievalResult>();
    for (const result of keywordResults) {
      merged.set(result.chunk.id, {
        ...result,
        score: result.score * 0.5
      });
    }

    for (const result of vectorResults) {
      const existing = merged.get(result.chunk.id);
      if (existing) {
        existing.score += result.score * 0.5;
        existing.retrievalMethod = `${existing.retrievalMethod}+vector`;
      } else {
        merged.set(result.chunk.id, {
          ...result,
          score: result.score * 0.5
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async searchKeywordSqliteFts(
    queryTokens: string[],
    topK: number,
    filters: RetrievalFilters
  ): Promise<RetrievalResult[]> {
    const titleMatches = await this.searchKeywordSqliteSourceMatches(queryTokens, topK, filters);
    const ftsTokens = queryTokens.slice(0, this.sqliteFtsTokenLimit());
    const ftsQuery = ftsTokens.map(token => `"${token}"`).join(ftsTokens.length > 1 ? ' ' : ' OR ');

    if (ftsTokens.length === 1 && titleMatches.length >= topK) {
      return titleMatches;
    }

    if (!ftsQuery) {
      return titleMatches;
    }

    const rows = await this.database.query(
      `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json
       FROM document_chunks_fts
       JOIN document_chunks dc ON dc.rowid = document_chunks_fts.rowid
       LEFT JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
       WHERE document_chunks_fts MATCH ?
       ${ftsTokens.length > 1 ? 'ORDER BY bm25(document_chunks_fts)' : 'ORDER BY dc.rowid'}
       LIMIT ?`,
      [ftsQuery, topK]
    );

    const ftsMatches = rows.rows
      .map(row => ({
        chunk: this.rowToChunk(row),
        score: this.keywordScore(queryTokens, this.tokenize(row.content)),
        retrievalMethod: 'keyword'
      }))
      .filter(result => result.score > 0 && this.matchesFilters(result.chunk, filters));

    return this.mergeKeywordResults([...titleMatches, ...ftsMatches], topK);
  }

  private async searchKeywordSqliteSourceMatches(
    queryTokens: string[],
    topK: number,
    filters: RetrievalFilters
  ): Promise<RetrievalResult[]> {
    const tokens = queryTokens.slice(0, this.sqliteFtsTokenLimit());
    if (tokens.length === 0) {
      return [];
    }

    const clauses = tokens
      .map(() => '(LOWER(ks.title) LIKE ? OR LOWER(ks.source) LIKE ?)')
      .join(' AND ');
    const params = tokens.flatMap(token => [`%${token}%`, `%${token}%`]);

    const rows = await this.database.query(
      `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json,
              ks.title AS source_title, ks.source AS source_path
       FROM knowledge_sources ks
       JOIN document_chunks dc ON dc.source_id = ks.id
       LEFT JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
       WHERE ${clauses}
       ORDER BY dc.chunk_index ASC, dc.rowid ASC
       LIMIT ?`,
      [...params, topK]
    );

    return rows.rows
      .map(row => ({
        chunk: this.rowToChunk(row),
        score: 1 + this.keywordScore(queryTokens, this.tokenize(`${row.source_title || ''} ${row.source_path || ''}`)),
        retrievalMethod: 'keyword'
      }))
      .filter(result => this.matchesFilters(result.chunk, filters));
  }

  private mergeKeywordResults(results: RetrievalResult[], topK: number): RetrievalResult[] {
    const merged = new Map<string, RetrievalResult>();

    for (const result of results) {
      const existing = merged.get(result.chunk.id);
      if (!existing || result.score > existing.score) {
        merged.set(result.chunk.id, result);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async searchKeywordSqliteLike(
    queryTokens: string[],
    topK: number,
    filters: RetrievalFilters
  ): Promise<RetrievalResult[]> {
    const tokens = queryTokens.slice(0, this.sqliteFtsTokenLimit());
    const whereClauses = tokens.map(() => 'LOWER(dc.content) LIKE ?').join(' OR ');
    const scoreExpression = tokens.map(() => 'CASE WHEN LOWER(dc.content) LIKE ? THEN 1 ELSE 0 END').join(' + ');
    const likeParams = tokens.map(token => `%${token}%`);

    const rows = await this.database.query(
      `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json
       FROM document_chunks dc
       LEFT JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
       WHERE ${whereClauses}
       ORDER BY (${scoreExpression}) DESC, dc.updated_at DESC
       LIMIT ?`,
      [...likeParams, ...likeParams, topK]
    );

    return rows.rows
      .map(row => ({
        chunk: this.rowToChunk(row),
        score: this.keywordScore(queryTokens, this.tokenize(row.content)),
        retrievalMethod: 'keyword'
      }))
      .filter(result => result.score > 0 && this.matchesFilters(result.chunk, filters))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async searchSimilarSqlite(
    queryEmbedding: number[],
    topK: number,
    filters: RetrievalFilters,
    candidateIds?: string[]
  ): Promise<RetrievalResult[]> {
    if (candidateIds?.length) {
      return this.searchSimilarSqliteCandidates(queryEmbedding, candidateIds, topK, filters);
    }

    const pageSize = this.sqliteVectorScanPageSize();
    const best: RetrievalResult[] = [];
    let lastId = '';
    let hasMore = true;

    while (hasMore) {
      const rows = await this.database.query(
        `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json
         FROM chunk_embeddings ce
         JOIN document_chunks dc ON dc.id = ce.chunk_id
         WHERE dc.id > ?
         ORDER BY dc.id
         LIMIT ?`,
        [lastId, pageSize]
      );

      if (rows.rows.length === 0) {
        hasMore = false;
        break;
      }

      this.scoreSqliteVectorRows(rows.rows, queryEmbedding, filters, best, topK);
      lastId = rows.rows[rows.rows.length - 1].id;
    }

    return best.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private async searchSimilarSqliteCandidates(
    queryEmbedding: number[],
    candidateIds: string[],
    topK: number,
    filters: RetrievalFilters
  ): Promise<RetrievalResult[]> {
    const best: RetrievalResult[] = [];
    const batchSize = this.sqliteCandidateBatchSize();
    const uniqueIds = Array.from(new Set(candidateIds));

    for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
      const batch = uniqueIds.slice(offset, offset + batchSize);
      const placeholders = batch.map(() => '?').join(', ');
      const rows = await this.database.query(
        `SELECT dc.id, dc.content, dc.metadata, dc.parent_id, ce.embedding_json
         FROM document_chunks dc
         JOIN chunk_embeddings ce ON ce.chunk_id = dc.id
         WHERE dc.id IN (${placeholders})`,
        batch
      );

      this.scoreSqliteVectorRows(rows.rows, queryEmbedding, filters, best, topK);
    }

    return best.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private scoreSqliteVectorRows(
    rows: any[],
    queryEmbedding: number[],
    filters: RetrievalFilters,
    best: RetrievalResult[],
    topK: number
  ): void {
    for (const row of rows) {
      const chunk = this.rowToChunk(row);
      if (!chunk.embedding || !this.matchesFilters(chunk, filters)) {
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score <= 0) {
        continue;
      }

      best.push({
        chunk,
        score,
        retrievalMethod: 'vector'
      });
    }

    best.sort((a, b) => b.score - a.score);
    if (best.length > topK) {
      best.length = topK;
    }
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

  private buildUpsertSourceQuery(
    sourceId: string,
    source: string,
    chunk: DocumentChunk,
    sourceType: string | undefined,
    metadata: Record<string, any>
  ): { sql: string; params: any[] } {
    const params = [
      sourceId,
      source,
      sourceType || chunk.metadata.type || 'document',
      chunk.metadata.title || null,
      this.hash(source),
      JSON.stringify(metadata)
    ];

    if (this.database.getType() === 'postgresql') {
      return {
        sql: `INSERT INTO knowledge_sources (id, source, source_type, title, content_hash, metadata, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO UPDATE SET
                source = EXCLUDED.source,
                source_type = EXCLUDED.source_type,
                title = EXCLUDED.title,
                content_hash = EXCLUDED.content_hash,
                metadata = EXCLUDED.metadata,
                updated_at = CURRENT_TIMESTAMP`,
        params
      };
    }

    return {
      sql: `INSERT OR REPLACE INTO knowledge_sources (id, source, source_type, title, content_hash, metadata, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      params
    };
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

  private buildIngestionRunQuery(
    runId: string,
    sourceId: string,
    chunksCount: number,
    metadata: Record<string, any>
  ): { sql: string; params: any[] } {
    const params = [runId, sourceId, 'completed', chunksCount, JSON.stringify(metadata)];

    if (this.database.getType() === 'postgresql') {
      return {
        sql: `INSERT INTO ingestion_runs (id, source_id, status, chunks_count, metadata, completed_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                chunks_count = EXCLUDED.chunks_count,
                metadata = EXCLUDED.metadata,
                completed_at = CURRENT_TIMESTAMP`,
        params
      };
    }

    return {
      sql: `INSERT OR REPLACE INTO ingestion_runs (id, source_id, status, chunks_count, metadata, completed_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      params
    };
  }

  private buildStartIngestionRunQuery(
    runId: string,
    sourceId: string,
    metadata: Record<string, any>
  ): { sql: string; params: any[] } {
    const params = [runId, sourceId, 'running', 0, null, JSON.stringify(metadata), null];

    if (this.database.getType() === 'postgresql') {
      return {
        sql: `INSERT INTO ingestion_runs (id, source_id, status, chunks_count, error, metadata, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                source_id = EXCLUDED.source_id,
                status = EXCLUDED.status,
                chunks_count = EXCLUDED.chunks_count,
                error = EXCLUDED.error,
                metadata = EXCLUDED.metadata,
                started_at = CURRENT_TIMESTAMP,
                completed_at = EXCLUDED.completed_at`,
        params
      };
    }

    return {
      sql: `INSERT OR REPLACE INTO ingestion_runs (id, source_id, status, chunks_count, error, metadata, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params
    };
  }

  private buildCompleteIngestionRunQuery(
    runId: string,
    chunksCount: number,
    metadata: Record<string, any>
  ): { sql: string; params: any[] } {
    return {
      sql: `UPDATE ingestion_runs
            SET status = ?, chunks_count = ?, error = ?, metadata = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      params: ['completed', chunksCount, null, JSON.stringify(metadata), runId]
    };
  }

  private buildDeleteCitationsForSourceQuery(sourceId: string): { sql: string; params: any[] } {
    return {
      sql: `DELETE FROM source_citations
            WHERE source_id = ?
               OR chunk_id IN (SELECT id FROM document_chunks WHERE source_id = ?)`,
      params: [sourceId, sourceId]
    };
  }

  private buildDeleteEmbeddingsForSourceQuery(sourceId: string): { sql: string; params: any[] } {
    return {
      sql: `DELETE FROM chunk_embeddings
            WHERE chunk_id IN (SELECT id FROM document_chunks WHERE source_id = ?)`,
      params: [sourceId]
    };
  }

  private buildDeleteChunksForSourceQuery(sourceId: string): { sql: string; params: any[] } {
    return {
      sql: 'DELETE FROM document_chunks WHERE source_id = ?',
      params: [sourceId]
    };
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

  private buildUpsertChunkQuery(chunk: DocumentChunk, sourceId: string, runId: string): { sql: string; params: any[] } {
    const metadata = JSON.stringify(chunk.metadata);
    const tokenCount = chunk.content.split(/\s+/).filter(Boolean).length;

    const sql = this.database.getType() === 'postgresql'
      ? `INSERT INTO document_chunks (id, source_id, ingestion_run_id, content, chunk_index, token_count, metadata, parent_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           source_id = EXCLUDED.source_id,
           ingestion_run_id = EXCLUDED.ingestion_run_id,
           content = EXCLUDED.content,
           chunk_index = EXCLUDED.chunk_index,
           token_count = EXCLUDED.token_count,
           metadata = EXCLUDED.metadata,
           parent_id = EXCLUDED.parent_id,
           updated_at = CURRENT_TIMESTAMP`
      : `INSERT OR REPLACE INTO document_chunks (id, source_id, ingestion_run_id, content, chunk_index, token_count, metadata, parent_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    return {
      sql,
      params: [chunk.id, sourceId, runId, chunk.content, chunk.metadata.chunkIndex ?? null, tokenCount, metadata, chunk.parentId || null]
    };
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

  private buildUpsertEmbeddingQuery(chunk: DocumentChunk, options: SaveChunkOptions): { sql: string; params: any[] } {
    const embeddingJson = JSON.stringify(chunk.embedding);
    const dimensions = chunk.embedding?.length || 0;

    if (this.database.getType() === 'postgresql') {
      return {
        sql: `INSERT INTO chunk_embeddings (chunk_id, provider, model, dimensions, embedding_json, embedding_vector)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (chunk_id) DO UPDATE SET
                provider = EXCLUDED.provider,
                model = EXCLUDED.model,
                dimensions = EXCLUDED.dimensions,
                embedding_json = EXCLUDED.embedding_json,
                embedding_vector = EXCLUDED.embedding_vector`,
        params: [
          chunk.id,
          options.embeddingProvider || null,
          options.embeddingModel || null,
          dimensions,
          embeddingJson,
          this.toPgVector(chunk.embedding || [])
        ]
      };
    }

    return {
      sql: `INSERT OR REPLACE INTO chunk_embeddings (chunk_id, provider, model, dimensions, embedding_json)
            VALUES (?, ?, ?, ?, ?)`,
      params: [chunk.id, options.embeddingProvider || null, options.embeddingModel || null, dimensions, embeddingJson]
    };
  }

  private persistenceBatchSize(): number {
    const parsed = Number(
      process.env.RAG_PERSISTENCE_BATCH_SIZE ||
      process.env.BOOKS_PERSISTENCE_BATCH_SIZE ||
      500
    );

    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 500;
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

  private rowToSourceRecord(row: any): KnowledgeSourceRecord {
    const metadata = this.parseJson(row.metadata) || {};
    const source = String(row.source || '');
    const sourceType = row.source_type || metadata.type || undefined;
    const title = this.cleanDisplayText(row.title || metadata.title || this.basename(source) || source || 'Untitled source');
    const author = this.firstString(
      metadata.author,
      metadata.creator,
      metadata.createdBy,
      metadata.info?.Author,
      Array.isArray(metadata.authors) ? metadata.authors.join(', ') : undefined
    );
    const publishedDate = this.firstString(
      metadata.publishedDate,
      metadata.publicationDate,
      metadata.date,
      metadata.info?.CreationDate
    );
    const warnings = Array.isArray(metadata.extractionWarnings)
      ? metadata.extractionWarnings.map((warning: unknown) => String(warning))
      : [];
    const fileExtension = this.sourceExtension(source, metadata.fileExtension || metadata.originalExtension);
    const emptyExtraction = metadata.emptyExtraction === true;
    const needsOcr = this.sourceNeedsOcr(sourceType, fileExtension, metadata, warnings);

    return {
      id: row.id,
      source,
      sourceType,
      title,
      author,
      publishedDate,
      fileExtension,
      citationLabel: this.formatCitationLabel(title, author, source),
      chunks: Number(row.chunks || 0),
      embeddings: Number(row.embeddings || 0),
      metadata,
      warnings,
      needsOcr,
      emptyExtraction,
      duplicateKey: this.duplicateKey(title, author),
      duplicateCount: 1,
      latestRun: {
        id: row.latest_run_id || undefined,
        status: row.latest_run_status || undefined,
        chunksCount: row.latest_run_chunks !== undefined && row.latest_run_chunks !== null
          ? Number(row.latest_run_chunks)
          : undefined,
        error: row.latest_run_error || undefined,
        completedAt: row.latest_run_completed_at || undefined
      },
      createdAt: row.created_at || undefined,
      updatedAt: row.updated_at || undefined
    };
  }

  private annotateDuplicateSources(sources: KnowledgeSourceRecord[]): void {
    const groups = new Map<string, KnowledgeSourceRecord[]>();

    for (const source of sources) {
      if (!source.duplicateKey) {
        continue;
      }
      const group = groups.get(source.duplicateKey) || [];
      group.push(source);
      groups.set(source.duplicateKey, group);
    }

    for (const group of groups.values()) {
      for (const source of group) {
        source.duplicateCount = group.length;
      }
    }
  }

  private sourceNeedsOcr(
    sourceType: string | undefined,
    fileExtension: string | undefined,
    metadata: Record<string, any>,
    warnings: string[]
  ): boolean {
    const isPdf = sourceType === 'pdf' || fileExtension === '.pdf';
    if (!isPdf) {
      return false;
    }

    if (metadata.needsOcr === true || metadata.emptyExtraction === true) {
      return true;
    }

    if (metadata.pdfOcrStatus === 'blocked' || metadata.pdfOcrStatus === 'failed') {
      return true;
    }

    return warnings.some(warning =>
      /no extractable text|image-only|scanned|ocr.+(?:disabled|required|blocked|failed)|pdf text extraction produced no text/i.test(warning)
    );
  }

  private formatCitationLabel(title: string, author: string | undefined, source: string): string {
    const label = [title, author].filter(Boolean).join(' - ');
    return label || this.basename(source) || source || 'local knowledge base';
  }

  private duplicateKey(title: string, author?: string): string | undefined {
    const normalizedTitle = this.normalizeIdentity(title);
    if (!normalizedTitle || normalizedTitle.length < 4) {
      return undefined;
    }

    const normalizedAuthor = this.normalizeIdentity(author || '');
    return normalizedAuthor ? `${normalizedTitle}|${normalizedAuthor}` : normalizedTitle;
  }

  private normalizeIdentity(value: string): string {
    return String(value || '')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/\[[^\]]+\]|\([^)]+\)/g, ' ')
      .replace(/\b(?:epub|mobi|azw3?|pdf|retail|scan|ebook|edition|volume|vol)\b/gi, ' ')
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private sourceExtension(source: string, fallback?: string): string | undefined {
    const match = source.match(/(\.[a-z0-9]+)$/i);
    const extension = match?.[1] || fallback;
    return extension ? String(extension).toLowerCase() : undefined;
  }

  private basename(source: string): string {
    return source.split(/[\\/]/).filter(Boolean).pop() || source;
  }

  private firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return this.cleanDisplayText(value);
      }
    }
    return undefined;
  }

  private cleanDisplayText(value: string): string {
    return String(value).replace(/\s+/g, ' ').trim();
  }

  private clampPositiveInt(
    value: unknown,
    fallback: number,
    min: number = 1,
    max: number = Number.MAX_SAFE_INTEGER
  ): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private sqliteFtsTokenLimit(): number {
    const parsed = Number(process.env.RAG_SQLITE_FTS_TOKEN_LIMIT || 8);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 8;
  }

  private sqliteKeywordCandidateLimit(): number {
    const parsed = Number(process.env.RAG_SQLITE_KEYWORD_CANDIDATES || 250);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 250;
  }

  private sqliteCandidateBatchSize(): number {
    const parsed = Number(process.env.RAG_SQLITE_CANDIDATE_BATCH_SIZE || 500);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 500;
  }

  private sqliteVectorScanPageSize(): number {
    const parsed = Number(process.env.RAG_SQLITE_VECTOR_SCAN_PAGE_SIZE || 1000);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1000;
  }

  private sqliteFullVectorScanEnabled(): boolean {
    return process.env.RAG_SQLITE_FULL_VECTOR_SCAN === 'true';
  }

  private rowToChunk(row: any): DocumentChunk {
    return {
      id: row.id,
      content: row.content,
      metadata: this.parseJson(row.metadata) || {},
      parentId: row.parent_id || undefined,
      embedding: row.embedding_json ? this.parseJson(row.embedding_json) : undefined
    };
  }

  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'about', 'after', 'again', 'against', 'also', 'and', 'are', 'because', 'been', 'being',
      'but', 'are', 'any', 'all', 'ask',
      'book', 'can', 'could', 'did', 'does', 'explain', 'for', 'from', 'had', 'happen',
      'happens', 'has', 'have', 'her', 'here', 'him', 'his', 'how', 'into', 'its',
      'may', 'more', 'most', 'not', 'our', 'out', 'off', 'one',
      'she', 'should', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
      'they', 'this', 'those', 'through', 'tell', 'summarize', 'summary', 'was', 'were',
      'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
      'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me',
      'my', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'
    ]);

    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 1 && !stopWords.has(token));
  }

  private keywordScore(queryTokens: string[], documentTokens: string[]): number {
    if (queryTokens.length === 0 || documentTokens.length === 0) {
      return 0;
    }

    const documentTokenSet = new Set(documentTokens);
    const matches = queryTokens.filter(token => documentTokenSet.has(token)).length;
    return matches / queryTokens.length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  private toPgVector(embedding: number[]): string | null {
    if (embedding.length === 0) {
      return null;
    }

    return `[${embedding.join(',')}]`;
  }

  private matchesFilters(chunk: DocumentChunk, filters: RetrievalFilters): boolean {
    if (chunk.metadata.excludedFromRetrieval) return false;
    if (filters.excludeDeprecated && chunk.metadata.authority === 'deprecated') return false;
    if (filters.authority && !filters.authority.includes(chunk.metadata.authority)) return false;
    if (filters.project && chunk.metadata.project !== filters.project) return false;
    if (filters.visibility && !filters.visibility.includes(chunk.metadata.visibility || 'public')) return false;
    if (filters.minTrustScore !== undefined && (chunk.metadata.trustScore ?? 1) < filters.minTrustScore) return false;
    return true;
  }
}
