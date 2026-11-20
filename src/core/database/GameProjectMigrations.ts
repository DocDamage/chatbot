import type { DatabaseConfig } from './Database';

/** G01.1 uses the existing transactional SQLite startup migration batch. */
export function getGameProjectMigrations(type: DatabaseConfig['type']): string[] {
  if (type !== 'sqlite') return []; // PostgreSQL enrollment remains explicitly unavailable, not silently ephemeral.
  return [
    `CREATE TABLE IF NOT EXISTS game_enrolled_projects (
      owner_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      canonical_root TEXT NOT NULL,
      physical_key TEXT NOT NULL,
      filesystem_identity TEXT NOT NULL,
      profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
      profile_digest TEXT NOT NULL CHECK(length(profile_digest) = 64),
      revision INTEGER NOT NULL CHECK(revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(owner_id, tenant_id, project_id),
      UNIQUE(owner_id, tenant_id, canonical_root),
      UNIQUE(owner_id, tenant_id, physical_key)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_game_projects_owner ON game_enrolled_projects(owner_id, tenant_id, updated_at)'
  ];
}
