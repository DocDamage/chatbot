import { logger } from '../observability/logger';
import { Database } from './Database';
import { getExpansionMigrations } from './ExpansionMigrations';

const initialized = new WeakSet<Database>();

export async function ensureExpansionDatabase(database?: Database): Promise<Database> {
  if (!database) {
    throw new Error('Database persistence is required for expansion modules. Enable SQLite or configure DATABASE_URL/RAG_DATABASE_URL.');
  }

  if (initialized.has(database)) {
    return database;
  }

  const migrations = getExpansionMigrations(database.getType());
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
