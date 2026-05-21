import { logger } from '../observability/logger';
import { Database } from './Database';
import { getExpansionMigrations } from './ExpansionMigrations';

const initialized = new WeakSet<Database>();

type ExpansionDatabaseType = 'sqlite' | 'postgresql';

export async function ensureExpansionDatabase(database?: Database): Promise<Database> {
  if (!database) {
    throw new Error('Database persistence is required for expansion modules. Enable SQLite or configure DATABASE_URL/RAG_DATABASE_URL.');
  }

  if (initialized.has(database)) {
    return database;
  }

  const migrations = [
    ...getExpansionMigrations(database.getType()),
    ...getRuntimeExpansionMigrations(database.getType())
  ];
  for (const migration of migrations) {
    try {
      await database.query(migration);
    } catch (error: any) {
      logger.warn('Expansion migration failed', { error: error.message });
    }
  }

  initialized.add(database);
  logger.info('Expansion database tables ready', { type: database.getType(), migrations: migrations.length });
  return database;
}

export function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function boolParam(database: Database, value: boolean): boolean | number {
  return database.getType() === 'postgresql' ? value : value ? 1 : 0;
}

function getRuntimeExpansionMigrations(type: ExpansionDatabaseType): string[] {
  const isPostgres = type === 'postgresql';
  const jsonType = isPostgres ? 'JSONB' : 'TEXT';
  const timestampType = isPostgres ? 'TIMESTAMPTZ' : 'DATETIME';
  const timestampDefault = 'CURRENT_TIMESTAMP';

  return [
    `CREATE TABLE IF NOT EXISTS sec_ingestion_queue (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      cik TEXT,
      ticker TEXT,
      forms_json ${jsonType},
      limit_per_company INTEGER,
      include_facts INTEGER DEFAULT 1,
      parse_primary_documents INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      started_at ${timestampType},
      completed_at ${timestampType},
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (run_id) REFERENCES sec_ingestion_runs(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_ingestion_queue_status_run
      ON sec_ingestion_queue (status, run_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sec_ingestion_queue_cik
      ON sec_ingestion_queue (cik)`
  ];
}
