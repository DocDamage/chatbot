/**
 * Database Abstraction Layer
 * Supports SQLite (development) and PostgreSQL (production)
 */

import { logger } from '../observability/logger';

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  connectionString?: string;
  filePath?: string; // For SQLite
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
}

export class Database {
  private db: any;
  private config: DatabaseConfig;
  private initialized: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  getType(): DatabaseConfig['type'] {
    return this.config.type;
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (this.config.type === 'sqlite') {
        try {
          const sqlite3 = require('better-sqlite3');
          const path = require('path');
          const dbPath = this.config.filePath || path.join(process.cwd(), 'data', 'chatbot.db');
          
          // Ensure directory exists
          const fs = require('fs');
          const dir = path.dirname(dbPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          this.db = sqlite3(dbPath);
          logger.info('SQLite database initialized', { path: dbPath });
        } catch (error: any) {
          logger.warn('SQLite not available, database features disabled', { error: error.message });
          logger.info('Install better-sqlite3 or use PostgreSQL for persistent storage');
          throw new Error('SQLite not available. Install better-sqlite3 or use PostgreSQL.');
        }
      } else if (this.config.type === 'postgresql') {
        const { Pool } = require('pg');
        this.db = new Pool({
          connectionString: this.config.connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });
        logger.info('PostgreSQL database initialized');
      }

      this.initialized = true;
      await this.runMigrations();
    } catch (error: any) {
      this.initialized = false;
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a query - OPTIMIZED with prepared statement caching
   */
  private preparedStatements: Map<string, any> = new Map();

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (this.config.type === 'sqlite') {
        // Cache prepared statements for better performance
        const cacheKey = sql.trim();
        let stmt = this.preparedStatements.get(cacheKey);
        
        if (!stmt) {
          stmt = this.db.prepare(sql);
          this.preparedStatements.set(cacheKey, stmt);
        }

        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          const rows = params ? stmt.all(...params) : stmt.all();
          return { rows, rowCount: rows.length };
        } else {
          const result = params ? stmt.run(...params) : stmt.run();
          return { rows: [], rowCount: result.changes || 0 };
        }
      } else {
        // PostgreSQL connection pooling is handled by pg library
        const result = await this.db.query(sql, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      }
    } catch (error: any) {
      logger.error('Database query failed', { error: error.message, sql });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction (batch operation)
   */
  async batchQuery(queries: Array<{ sql: string; params?: any[] }>): Promise<QueryResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: QueryResult[] = [];
    
    try {
      if (this.config.type === 'sqlite') {
        const transaction = this.db.transaction((queries: Array<{ sql: string; params?: any[] }>) => {
          return queries.map(({ sql, params }) => {
            const cacheKey = sql.trim();
            let stmt = this.preparedStatements.get(cacheKey);
            
            if (!stmt) {
              stmt = this.db.prepare(sql);
              this.preparedStatements.set(cacheKey, stmt);
            }

            if (sql.trim().toUpperCase().startsWith('SELECT')) {
              const rows = params ? stmt.all(...params) : stmt.all();
              return { rows, rowCount: rows.length };
            } else {
              const result = params ? stmt.run(...params) : stmt.run();
              return { rows: [], rowCount: result.changes || 0 };
            }
          });
        });
        
        return transaction(queries);
      } else {
        // PostgreSQL: Use transaction
        await this.db.query('BEGIN');
        try {
          for (const { sql, params } of queries) {
            const result = await this.db.query(sql, params);
            results.push({
              rows: result.rows,
              rowCount: result.rowCount,
            });
          }
          await this.db.query('COMMIT');
          return results;
        } catch (error) {
          await this.db.query('ROLLBACK');
          throw error;
        }
      }
    } catch (error: any) {
      logger.error('Batch query failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    const baseMigrations = this.config.type === 'postgresql'
      ? [
          `CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
          )`,
          `CREATE TABLE IF NOT EXISTS episodic_memory (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            content TEXT NOT NULL,
            embedding JSONB,
            importance REAL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            title TEXT,
            content_hash TEXT,
            chunk_count INTEGER,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`
        ]
      : [
          `CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
          )`,
          `CREATE TABLE IF NOT EXISTS episodic_memory (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            content TEXT NOT NULL,
            embedding BLOB,
            importance REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            title TEXT,
            content_hash TEXT,
            chunk_count INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        ];

    const ragMigrations = this.config.type === 'postgresql'
      ? [
          `CREATE EXTENSION IF NOT EXISTS vector`,
          `CREATE TABLE IF NOT EXISTS knowledge_sources (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL UNIQUE,
            source_type TEXT,
            title TEXT,
            content_hash TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS ingestion_runs (
            id TEXT PRIMARY KEY,
            source_id TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            chunks_count INTEGER DEFAULT 0,
            error TEXT,
            metadata JSONB,
            started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMPTZ,
            FOREIGN KEY (source_id) REFERENCES knowledge_sources(id)
          )`,
          `CREATE TABLE IF NOT EXISTS document_chunks (
            id TEXT PRIMARY KEY,
            source_id TEXT,
            ingestion_run_id TEXT,
            content TEXT NOT NULL,
            chunk_index INTEGER,
            token_count INTEGER,
            metadata JSONB,
            parent_id TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES knowledge_sources(id),
            FOREIGN KEY (ingestion_run_id) REFERENCES ingestion_runs(id),
            FOREIGN KEY (parent_id) REFERENCES document_chunks(id)
          )`,
          `CREATE TABLE IF NOT EXISTS chunk_embeddings (
            chunk_id TEXT PRIMARY KEY,
            provider TEXT,
            model TEXT,
            dimensions INTEGER,
            embedding_json JSONB NOT NULL,
            embedding_vector vector,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
          )`,
          `CREATE TABLE IF NOT EXISTS source_citations (
            id TEXT PRIMARY KEY,
            chunk_id TEXT NOT NULL,
            source_id TEXT,
            citation_text TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE,
            FOREIGN KEY (source_id) REFERENCES knowledge_sources(id)
          )`
        ]
      : [
          `CREATE TABLE IF NOT EXISTS knowledge_sources (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL UNIQUE,
            source_type TEXT,
            title TEXT,
            content_hash TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS ingestion_runs (
            id TEXT PRIMARY KEY,
            source_id TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            chunks_count INTEGER DEFAULT 0,
            error TEXT,
            metadata TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (source_id) REFERENCES knowledge_sources(id)
          )`,
          `CREATE TABLE IF NOT EXISTS document_chunks (
            id TEXT PRIMARY KEY,
            source_id TEXT,
            ingestion_run_id TEXT,
            content TEXT NOT NULL,
            chunk_index INTEGER,
            token_count INTEGER,
            metadata TEXT,
            parent_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES knowledge_sources(id),
            FOREIGN KEY (ingestion_run_id) REFERENCES ingestion_runs(id),
            FOREIGN KEY (parent_id) REFERENCES document_chunks(id)
          )`,
          `CREATE TABLE IF NOT EXISTS chunk_embeddings (
            chunk_id TEXT PRIMARY KEY,
            provider TEXT,
            model TEXT,
            dimensions INTEGER,
            embedding_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
          )`,
          `CREATE TABLE IF NOT EXISTS source_citations (
            id TEXT PRIMARY KEY,
            chunk_id TEXT NOT NULL,
            source_id TEXT,
            citation_text TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE,
            FOREIGN KEY (source_id) REFERENCES knowledge_sources(id)
          )`
        ];

    const migrations = [...baseMigrations, ...ragMigrations];

    for (const migration of migrations) {
      try {
        await this.query(migration);
      } catch (error: any) {
        logger.warn('Migration failed (may already exist)', { error: error.message });
      }
    }

    logger.info('Database migrations completed');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.config.type === 'sqlite' && this.db) {
      this.db.close();
    } else if (this.config.type === 'postgresql' && this.db) {
      await this.db.end();
    }
    this.initialized = false;
    logger.info('Database connection closed');
  }
}

