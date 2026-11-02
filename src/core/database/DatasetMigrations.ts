/**
 * Dataset & Knowledge Pack Database Migrations (CRK-P06-T03)
 *
 * Implements SQLite and PostgreSQL compatible migrations for knowledge datasets,
 * versions, knowledge packs, memberships, source links, and background jobs.
 */

import type { DatabaseConfig } from './Database';

export function getDatasetMigrations(type: DatabaseConfig['type']): string[] {
  const isPostgres = type === 'postgresql';
  const jsonType = isPostgres ? 'JSONB' : 'TEXT';
  const timestampType = isPostgres ? 'TIMESTAMPTZ' : 'DATETIME';
  const timestampDefault = 'CURRENT_TIMESTAMP';
  const boolType = isPostgres ? 'BOOLEAN' : 'INTEGER';

  return [
    `CREATE TABLE IF NOT EXISTS knowledge_datasets (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_uri TEXT,
      license_id TEXT,
      license_metadata ${jsonType},
      authority_score REAL NOT NULL DEFAULT 0.8,
      refresh_policy TEXT DEFAULT 'manual',
      install_policy TEXT DEFAULT 'download',
      enabled ${boolType} DEFAULT 1,
      current_version TEXT,
      metadata ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_datasets_slug ON knowledge_datasets (slug)`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_datasets_source_type ON knowledge_datasets (source_type)`,

    `CREATE TABLE IF NOT EXISTS knowledge_dataset_versions (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      version TEXT NOT NULL,
      released_at ${timestampType},
      discovered_at ${timestampType} DEFAULT ${timestampDefault},
      installed_at ${timestampType},
      document_count INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      byte_size INTEGER DEFAULT 0,
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      metadata ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (dataset_id) REFERENCES knowledge_datasets(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset ON knowledge_dataset_versions (dataset_id, version)`,

    `CREATE TABLE IF NOT EXISTS knowledge_packs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      default_routing_domains ${jsonType},
      enabled ${boolType} DEFAULT 1,
      precedence INTEGER DEFAULT 100,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_packs_category ON knowledge_packs (category)`,

    `CREATE TABLE IF NOT EXISTS knowledge_pack_memberships (
      pack_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      added_at ${timestampType} DEFAULT ${timestampDefault},
      PRIMARY KEY (pack_id, dataset_id),
      FOREIGN KEY (pack_id) REFERENCES knowledge_packs(id) ON DELETE CASCADE,
      FOREIGN KEY (dataset_id) REFERENCES knowledge_datasets(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS dataset_source_links (
      dataset_id TEXT NOT NULL,
      dataset_version_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      external_id TEXT,
      external_url TEXT,
      source_version TEXT,
      license_id TEXT,
      metadata ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      PRIMARY KEY (dataset_id, dataset_version_id, source_id),
      FOREIGN KEY (dataset_id) REFERENCES knowledge_datasets(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS dataset_jobs (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      dataset_version_id TEXT,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      started_at ${timestampType},
      completed_at ${timestampType},
      progress_current REAL DEFAULT 0,
      progress_total REAL DEFAULT 100,
      error_code TEXT,
      error_message TEXT,
      metadata ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (dataset_id) REFERENCES knowledge_datasets(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dataset_jobs_status ON dataset_jobs (dataset_id, status)`,

    `CREATE TABLE IF NOT EXISTS message_feedback (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      user_id TEXT,
      reaction TEXT,
      rating INTEGER,
      comment TEXT,
      created_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_message_feedback_session ON message_feedback (session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_message_feedback_user ON message_feedback (user_id)`,

    `CREATE TABLE IF NOT EXISTS chat_runs (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL,
      task_type TEXT NOT NULL,
      intent TEXT,
      workflow_id TEXT,
      bot_profile_id TEXT,
      bot_profile_version TEXT,
      model_provider TEXT,
      model_name TEXT,
      model_policy_version TEXT,
      retrieval_policy_version TEXT,
      prompt_version TEXT,
      fallback_used ${boolType} DEFAULT 0,
      latency_ms REAL,
      error_code TEXT,
      metadata ${jsonType},
      started_at ${timestampType} DEFAULT ${timestampDefault},
      completed_at ${timestampType}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_runs_session ON chat_runs (session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_runs_trace ON chat_runs (trace_id)`,

    `CREATE TABLE IF NOT EXISTS chat_run_sources (
      chat_run_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      chunk_id TEXT NOT NULL,
      rank INTEGER,
      score REAL,
      selected ${boolType} DEFAULT 1,
      metadata ${jsonType},
      PRIMARY KEY (chat_run_id, source_id, chunk_id),
      FOREIGN KEY (chat_run_id) REFERENCES chat_runs(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS chat_run_tools (
      chat_run_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      status TEXT NOT NULL,
      inputs_digest TEXT,
      verification_status TEXT,
      metadata ${jsonType},
      PRIMARY KEY (chat_run_id, tool_call_id),
      FOREIGN KEY (chat_run_id) REFERENCES chat_runs(id) ON DELETE CASCADE
    )`,
  ];
}
