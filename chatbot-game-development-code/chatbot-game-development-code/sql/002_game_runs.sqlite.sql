-- Additive reference migration. The host's migration ledger applies this once.
-- SQLite only: port types/JSON/transactions explicitly before PostgreSQL use.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS game_projects (
  project_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  canonical_root TEXT NOT NULL,
  engine TEXT NOT NULL CHECK(engine IN ('godot','unity','unreal','rpg-maker-mz','rom')),
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
  profile_digest TEXT NOT NULL CHECK(length(profile_digest) = 64),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(tenant_id, owner_id, canonical_root),
  UNIQUE(project_key, owner_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS game_runs (
  run_id TEXT PRIMARY KEY,
  project_key TEXT NOT NULL REFERENCES game_projects(project_key),
  owner_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL CHECK(length(request_digest) = 64),
  phase TEXT NOT NULL CHECK(phase IN (
    'queued','profiling','retrieving','drafting','awaiting_approval','applying',
    'verifying','repairable','repairing','blocked','interrupted','cancelling',
    'succeeded','failed','cancelled','timed_out'
  )),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  repairs_started INTEGER NOT NULL DEFAULT 0 CHECK(repairs_started >= 0),
  max_repair_attempts INTEGER NOT NULL DEFAULT 2 CHECK(max_repair_attempts BETWEEN 0 AND 5),
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deadline_at_ms INTEGER NOT NULL,
  CHECK(deadline_at_ms > created_at_ms),
  CHECK(repairs_started <= max_repair_attempts),
  UNIQUE(tenant_id, owner_id, idempotency_key),
  UNIQUE(run_id, project_key),
  FOREIGN KEY(project_key, owner_id, tenant_id)
    REFERENCES game_projects(project_key, owner_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS game_runs_project_phase ON game_runs(project_key, phase, updated_at_ms);

CREATE TABLE IF NOT EXISTS game_run_events (
  run_id TEXT NOT NULL REFERENCES game_runs(run_id),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  event_id TEXT NOT NULL UNIQUE,
  event_json TEXT NOT NULL CHECK(json_valid(event_json)),
  occurred_at_ms INTEGER NOT NULL,
  PRIMARY KEY(run_id, revision)
);

-- Keep lease rows permanently: deleting a row would reset its fencing sequence.
CREATE TABLE IF NOT EXISTS game_project_leases (
  project_key TEXT PRIMARY KEY REFERENCES game_projects(project_key),
  holder_run_id TEXT REFERENCES game_runs(run_id),
  fence INTEGER NOT NULL DEFAULT 0 CHECK(fence >= 0),
  expires_at_ms INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_proposals (
  proposal_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES game_runs(run_id),
  project_key TEXT NOT NULL REFERENCES game_projects(project_key),
  proposal_digest TEXT NOT NULL CHECK(length(proposal_digest) = 64),
  proposal_json TEXT NOT NULL CHECK(json_valid(proposal_json)),
  base_profile_digest TEXT NOT NULL CHECK(length(base_profile_digest) = 64),
  created_at_ms INTEGER NOT NULL,
  UNIQUE(run_id, proposal_digest),
  UNIQUE(proposal_id, run_id),
  FOREIGN KEY(run_id, project_key) REFERENCES game_runs(run_id, project_key)
);

CREATE TABLE IF NOT EXISTS game_approvals (
  approval_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES game_proposals(proposal_id),
  proposal_digest TEXT NOT NULL CHECK(length(proposal_digest) = 64),
  owner_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  grant_kind TEXT NOT NULL CHECK(grant_kind IN ('exact','scoped')),
  parent_grant_id TEXT,
  granted_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  revoked_at_ms INTEGER,
  consumed_transaction_id TEXT,
  CHECK(expires_at_ms > granted_at_ms),
  CHECK(grant_kind <> 'scoped' OR parent_grant_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS game_artifacts (
  artifact_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES game_runs(run_id),
  proposal_id TEXT REFERENCES game_proposals(proposal_id),
  kind TEXT NOT NULL CHECK(kind IN ('context','proposal','journal','log','evidence','build','rom-patch','screenshot','asset-manifest')),
  relative_path TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
  byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
  created_at_ms INTEGER NOT NULL,
  UNIQUE(run_id, relative_path),
  FOREIGN KEY(proposal_id, run_id) REFERENCES game_proposals(proposal_id, run_id)
);

COMMIT;
