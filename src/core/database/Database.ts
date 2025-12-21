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

      await this.runMigrations();
      this.initialized = true;
    } catch (error: any) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (this.config.type === 'sqlite') {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          const stmt = this.db.prepare(sql);
          const rows = params ? stmt.all(...params) : stmt.all();
          return { rows, rowCount: rows.length };
        } else {
          const stmt = this.db.prepare(sql);
          const result = params ? stmt.run(...params) : stmt.run();
          return { rows: [], rowCount: result.changes || 0 };
        }
      } else {
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
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    const migrations = [
      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Messages table
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )`,

      // Episodic memory table
      `CREATE TABLE IF NOT EXISTS episodic_memory (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        content TEXT NOT NULL,
        embedding BLOB,
        importance REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Document metadata table
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT,
        content_hash TEXT,
        chunk_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

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

