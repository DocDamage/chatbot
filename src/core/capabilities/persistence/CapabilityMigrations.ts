/**
 * Capability Platform Database Migrations (PX-02 / PX02-T11)
 * Defines SQL schemas for SQLite (local) and PostgreSQL (hosted) for all
 * capability entities, jobs, artifacts, permissions, approvals, and health checks.
 */

export const SQLITE_CAPABILITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS capability_sources (
  id TEXT PRIMARY KEY,
  repository TEXT,
  revision TEXT,
  license TEXT NOT NULL,
  integration TEXT NOT NULL,
  notices TEXT,
  verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_packs (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  maturity TEXT NOT NULL,
  source_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_pack_versions (
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (pack_id, version)
);

CREATE TABLE IF NOT EXISTS capability_installations (
  pack_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  installed_by TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_permissions (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  scope TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capability_health_snapshots (
  id TEXT PRIMARY KEY,
  capability_id TEXT NOT NULL,
  status TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  checks_json TEXT NOT NULL,
  degraded_reasons_json TEXT
);

CREATE TABLE IF NOT EXISTS capability_jobs (
  id TEXT PRIMARY KEY,
  capability_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  state TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  input_digest TEXT NOT NULL,
  approval_digest TEXT,
  resource_budget_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  failure_category TEXT
);

CREATE TABLE IF NOT EXISTS capability_job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES capability_jobs(id)
);

CREATE TABLE IF NOT EXISTS capability_approvals (
  approval_digest TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  request_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_artifacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  parent_artifact_ids_json TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256_digest TEXT NOT NULL,
  access_scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_cap_jobs_owner ON capability_jobs(owner_id, state);
CREATE INDEX IF NOT EXISTS idx_cap_jobs_created ON capability_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_cap_artifacts_job ON capability_artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_cap_artifacts_owner ON capability_artifacts(owner_id, project_id);
`;

export const POSTGRES_CAPABILITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS capability_sources (
  id VARCHAR(128) PRIMARY KEY,
  repository VARCHAR(255),
  revision VARCHAR(128),
  license VARCHAR(64) NOT NULL,
  integration VARCHAR(64) NOT NULL,
  notices JSONB,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capability_packs (
  id VARCHAR(128) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  maturity VARCHAR(64) NOT NULL,
  source_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capability_pack_versions (
  pack_id VARCHAR(128) NOT NULL,
  version VARCHAR(64) NOT NULL,
  manifest_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pack_id, version)
);

CREATE TABLE IF NOT EXISTS capability_installations (
  pack_id VARCHAR(128) PRIMARY KEY,
  version VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(64) NOT NULL,
  installed_by VARCHAR(128) NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capability_health_snapshots (
  id VARCHAR(128) PRIMARY KEY,
  capability_id VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL,
  checks_json JSONB NOT NULL,
  degraded_reasons_json JSONB
);

CREATE TABLE IF NOT EXISTS capability_jobs (
  id VARCHAR(128) PRIMARY KEY,
  capability_id VARCHAR(128) NOT NULL,
  pack_id VARCHAR(128) NOT NULL,
  owner_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128),
  state VARCHAR(64) NOT NULL,
  current_stage VARCHAR(128) NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  input_digest VARCHAR(64) NOT NULL,
  approval_digest VARCHAR(64),
  resource_budget_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  failure_category VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS capability_approvals (
  approval_digest VARCHAR(64) PRIMARY KEY,
  job_type VARCHAR(128) NOT NULL,
  capability_id VARCHAR(128) NOT NULL,
  owner_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128),
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  request_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS capability_artifacts (
  id VARCHAR(128) PRIMARY KEY,
  job_id VARCHAR(128) NOT NULL,
  capability_id VARCHAR(128) NOT NULL,
  pack_version VARCHAR(64) NOT NULL,
  owner_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128),
  parent_artifact_ids_json JSONB,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256_digest VARCHAR(64) NOT NULL,
  access_scope VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_pg_cap_jobs_owner ON capability_jobs(owner_id, state);
CREATE INDEX IF NOT EXISTS idx_pg_cap_artifacts_job ON capability_artifacts(job_id);
`;
