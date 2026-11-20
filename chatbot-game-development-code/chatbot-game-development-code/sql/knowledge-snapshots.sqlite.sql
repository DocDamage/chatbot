-- Reference additive migration; apply after the existing chatbot schema.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS knowledge_snapshots (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  evidence_target_id TEXT NOT NULL,
  revision_kind TEXT NOT NULL CHECK (revision_kind IN ('git-commit', 'artifact-sha256')),
  revision_value TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  extractor_version TEXT NOT NULL,
  chunker_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('staging', 'validated', 'ready', 'failed', 'retired')),
  retrieval_approved INTEGER NOT NULL DEFAULT 0 CHECK (retrieval_approved IN (0, 1)),
  expected_files INTEGER NOT NULL CHECK (expected_files >= 0),
  accepted_files INTEGER NOT NULL DEFAULT 0 CHECK (accepted_files >= 0),
  expected_chunks INTEGER NOT NULL CHECK (expected_chunks >= 0),
  lexical_ready INTEGER NOT NULL DEFAULT 0 CHECK (lexical_ready IN (0, 1)),
  required_embedding_space_id TEXT,
  validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_snapshots_scope
  ON knowledge_snapshots(corpus_id, evidence_target_id, state);

CREATE TABLE IF NOT EXISTS knowledge_snapshot_chunks (
  snapshot_id TEXT NOT NULL REFERENCES knowledge_snapshots(id) ON DELETE RESTRICT,
  chunk_id TEXT NOT NULL UNIQUE REFERENCES document_chunks(id) ON DELETE RESTRICT,
  source_path TEXT NOT NULL,
  locator_json TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
  PRIMARY KEY (snapshot_id, chunk_id)
);

CREATE TABLE IF NOT EXISTS knowledge_version_snapshots (
  dataset_version_id TEXT NOT NULL REFERENCES knowledge_dataset_versions(id) ON DELETE RESTRICT,
  snapshot_id TEXT NOT NULL REFERENCES knowledge_snapshots(id) ON DELETE RESTRICT,
  PRIMARY KEY (dataset_version_id, snapshot_id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_snapshot_owners
  ON knowledge_version_snapshots(snapshot_id);

-- Composite parent key makes a head unable to point at another dataset's version.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dataset_version_identity
  ON knowledge_dataset_versions(id, dataset_id);
CREATE TABLE IF NOT EXISTS knowledge_target_heads (
  corpus_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL REFERENCES knowledge_datasets(id) ON DELETE RESTRICT,
  target_id TEXT NOT NULL,
  dataset_version_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (corpus_id, dataset_id, target_id),
  FOREIGN KEY (dataset_version_id, dataset_id)
    REFERENCES knowledge_dataset_versions(id, dataset_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS knowledge_snapshot_pins (
  snapshot_id TEXT NOT NULL REFERENCES knowledge_snapshots(id) ON DELETE RESTRICT,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('project', 'job', 'citation', 'retention')),
  owner_id TEXT NOT NULL,
  expires_at_epoch INTEGER,
  PRIMARY KEY (snapshot_id, owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS knowledge_compatibility_approvals (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL,
  requested_target_id TEXT NOT NULL,
  evidence_target_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL REFERENCES knowledge_snapshots(id) ON DELETE RESTRICT,
  evidence_uri TEXT NOT NULL,
  valid_until_epoch INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_compatibility_lookup
  ON knowledge_compatibility_approvals(corpus_id, requested_target_id, snapshot_id, revoked);
