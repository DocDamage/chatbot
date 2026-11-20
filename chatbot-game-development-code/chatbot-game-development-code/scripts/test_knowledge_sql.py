#!/usr/bin/env python3
"""Reproduce the reference SQLite ownership/retrieval checks with the standard library.

Usage:
    python3 scripts/test_knowledge_sql.py
    python3 scripts/test_knowledge_sql.py --sql-dir /path/to/kit/sql

IMPORTANT: The parent tables below are a MINIMAL SYNTHETIC CONTRACT, not the
application's complete migrations. FTS5 external-content triggers model its current
insert/update/delete contract. The shipped additive schema and retrieval SQL are
loaded without rewriting. These tests exercise real SQLite transactions, foreign
keys, and FTS, but do not certify the application adapter, complete migrations,
PostgreSQL, acquisition, embedding providers, or an engine build.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest


SQL_DIR = Path(__file__).resolve().parents[1] / "sql"
CORPUS = "public:gamedev"
TARGET = "godot:4.3.0:gdscript"

SYNTHETIC_PARENT_CONTRACT = """
PRAGMA foreign_keys = ON;
CREATE TABLE knowledge_datasets (id TEXT PRIMARY KEY);
CREATE TABLE knowledge_dataset_versions (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES knowledge_datasets(id),
    version TEXT NOT NULL
);
CREATE TABLE document_chunks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE VIRTUAL TABLE document_chunks_fts USING fts5(
    id UNINDEXED, content, content='document_chunks', content_rowid='rowid'
);
CREATE TRIGGER document_chunks_ai_fts AFTER INSERT ON document_chunks BEGIN
    INSERT INTO document_chunks_fts(rowid, id, content)
    VALUES (new.rowid, new.id, new.content);
END;
CREATE TRIGGER document_chunks_ad_fts AFTER DELETE ON document_chunks BEGIN
    INSERT INTO document_chunks_fts(document_chunks_fts, rowid, id, content)
    VALUES ('delete', old.rowid, old.id, old.content);
END;
CREATE TRIGGER document_chunks_au_fts AFTER UPDATE ON document_chunks BEGIN
    INSERT INTO document_chunks_fts(document_chunks_fts, rowid, id, content)
    VALUES ('delete', old.rowid, old.id, old.content);
    INSERT INTO document_chunks_fts(rowid, id, content)
    VALUES (new.rowid, new.id, new.content);
END;
"""

HEAD_CAS = """
UPDATE knowledge_target_heads
SET dataset_version_id = ?, generation = generation + 1,
    activated_at = CURRENT_TIMESTAMP
WHERE corpus_id = ? AND dataset_id = ? AND target_id = ?
    AND dataset_version_id = ? AND generation = ?
"""


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def snapshot_id(label: str) -> str:
    return "snapshot:" + digest(label)


@contextmanager
def transaction(connection: sqlite3.Connection):
    """Use an actual explicit transaction, including when connection autocommits."""
    connection.execute("BEGIN IMMEDIATE")
    try:
        yield
    except BaseException:
        connection.execute("ROLLBACK")
        raise
    else:
        connection.execute("COMMIT")


class KnowledgeSqlContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory(prefix="knowledge-sql-contract-")
        self.addCleanup(self.directory.cleanup)
        self.database_path = Path(self.directory.name) / "fixture.sqlite"
        self.db = self.connect()
        self.addCleanup(lambda: self.db.close())
        self.schema = (SQL_DIR / "knowledge-snapshots.sqlite.sql").read_text(encoding="utf-8")
        self.query = (SQL_DIR / "retrieval-scoped.sqlite.sql").read_text(encoding="utf-8")
        try:
            self.db.executescript(SYNTHETIC_PARENT_CONTRACT)
        except sqlite3.OperationalError as error:
            if "fts5" in str(error).lower():
                raise RuntimeError("This test requires Python linked with SQLite FTS5 support.") from error
            raise
        self.db.executescript(self.schema)
        for dataset in ("pack-a", "pack-b"):
            self.db.execute("INSERT INTO knowledge_datasets(id) VALUES (?)", (dataset,))
            for version in ("1", "2"):
                self.db.execute(
                    "INSERT INTO knowledge_dataset_versions(id, dataset_id, version) VALUES (?, ?, ?)",
                    (dataset + "-v" + version, dataset, version),
                )

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, isolation_level=None, timeout=2)
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def add_snapshot(
        self, label: str, *, target: str = TARGET, corpus: str = CORPUS,
        state: str = "ready", approved: int = 1, lexical_ready: int = 1,
        content: str | None = "motion CharacterBody2D",
    ) -> tuple[str, str | None]:
        sid = snapshot_id(label)
        count = int(content is not None)
        self.db.execute(
            """INSERT INTO knowledge_snapshots (
                id, corpus_id, source_key, evidence_target_id, revision_kind,
                revision_value, manifest_sha256, extractor_version, chunker_version,
                state, retrieval_approved, expected_files, accepted_files,
                expected_chunks, lexical_ready
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (sid, corpus, "github:fixture/docs", target, "git-commit", "a" * 40,
             digest("manifest:" + label), "fixture-v1", "fixture-v1", state,
             approved, count, count, count, lexical_ready),
        )
        if content is None:
            return sid, None
        cid = "chunk:" + digest(label + ":chunk")
        self.db.execute("INSERT INTO document_chunks(id, content) VALUES (?, ?)", (cid, content))
        self.db.execute(
            """INSERT INTO knowledge_snapshot_chunks
            (snapshot_id, chunk_id, source_path, locator_json, content_sha256)
            VALUES (?, ?, ?, ?, ?)""",
            (sid, cid, label + ".md", '{"kind":"lines","startLine":1,"endLine":1,"part":0}', digest(content)),
        )
        return sid, cid

    def scoped(
        self, sid: str, *, target: str = TARGET, corpus: str = CORPUS,
        term: str = "motion", limit: int = 10, connection: sqlite3.Connection | None = None,
    ) -> list[tuple]:
        # The shipped example accepts two distinct, trusted snapshot/target pairs.
        # Pad a one-snapshot test with a deterministic absent snapshot, never a wildcard.
        parameters = (sid, target, snapshot_id("absent-padding"), target, term, corpus, limit)
        return (connection or self.db).execute(self.query, parameters).fetchall()

    def link(self, version: str, sid: str) -> None:
        self.db.execute("INSERT INTO knowledge_version_snapshots VALUES (?, ?)", (version, sid))

    def create_head(self, version: str = "pack-a-v1") -> None:
        self.db.execute(
            """INSERT INTO knowledge_target_heads
            (corpus_id, dataset_id, target_id, dataset_version_id, generation)
            VALUES (?, 'pack-a', ?, ?, 1)""", (CORPUS, TARGET, version),
        )

    def head(self, connection: sqlite3.Connection | None = None) -> tuple:
        row = (connection or self.db).execute(
            """SELECT dataset_version_id, generation FROM knowledge_target_heads
            WHERE corpus_id = ? AND dataset_id = 'pack-a' AND target_id = ?""", (CORPUS, TARGET),
        ).fetchone()
        self.assertIsNotNone(row)
        return row

    def cas(self, connection: sqlite3.Connection | None = None) -> int:
        return (connection or self.db).execute(
            HEAD_CAS, ("pack-a-v2", CORPUS, "pack-a", TARGET, "pack-a-v1", 1)
        ).rowcount

    def test_additive_migration_is_repeatable_and_references_are_sound(self) -> None:
        self.db.executescript(self.schema)
        self.db.executescript(self.schema)
        self.assertEqual(self.db.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_scope_is_applied_before_limit(self) -> None:
        for index in range(12):
            self.add_snapshot("wrong-" + str(index), target="godot:3.5.0:gdscript", content="motion motion motion motion")
        selected, cid = self.add_snapshot("selected", content="motion CharacterBody2D relevant documentation")
        global_winner = self.db.execute(
            """SELECT id FROM document_chunks_fts WHERE document_chunks_fts MATCH 'motion'
            ORDER BY bm25(document_chunks_fts), id LIMIT 1"""
        ).fetchone()[0]
        self.assertNotEqual(global_winner, cid, "Fixture must expose a post-LIMIT filtering bug")
        self.assertEqual([row[0] for row in self.scoped(selected, limit=1)], [cid])

    def test_target_pairs_are_exact_and_empty_selection_does_not_broaden(self) -> None:
        sid, _ = self.add_snapshot("selected")
        for target in ("godot:4.3", "godot:4.30.0:gdscript", "unknown", "*"):
            with self.subTest(target=target):
                self.assertEqual(self.scoped(sid, target=target), [])
        self.assertEqual(self.scoped(snapshot_id("not-selected")), [])

    def test_unready_private_unapproved_and_unindexed_content_are_invisible(self) -> None:
        cases = [
            {"state": state} for state in ("staging", "validated", "failed", "retired")
        ] + [{"corpus": "private:other"}, {"approved": 0}, {"lexical_ready": 0}]
        for index, options in enumerate(cases):
            with self.subTest(options=options):
                sid, _ = self.add_snapshot("excluded-" + str(index), **options)
                self.assertEqual(self.scoped(sid), [])

    def test_fts_tracks_insert_update_and_deletion(self) -> None:
        sid, cid = self.add_snapshot("freshness", content="firstuniquetoken")
        self.assertEqual(len(self.scoped(sid, term="firstuniquetoken")), 1)
        # Exercise the parent trigger contract; production immutable snapshots are insert-only.
        self.db.execute("UPDATE document_chunks SET content = ? WHERE id = ?", ("seconduniquetoken", cid))
        self.assertEqual(self.scoped(sid, term="firstuniquetoken"), [])
        self.assertEqual(len(self.scoped(sid, term="seconduniquetoken")), 1)
        self.db.execute("DELETE FROM knowledge_snapshot_chunks WHERE snapshot_id = ?", (sid,))
        self.db.execute("DELETE FROM document_chunks WHERE id = ?", (cid,))
        self.assertEqual(self.scoped(sid, term="seconduniquetoken"), [])
        self.assertEqual(self.db.execute(
            "SELECT count(*) FROM document_chunks_fts WHERE document_chunks_fts MATCH ?", ("seconduniquetoken",)
        ).fetchone()[0], 0)

    def test_head_cas_rejects_stale_writer_and_cross_dataset_pointer(self) -> None:
        self.create_head()
        observer = self.connect()
        self.addCleanup(observer.close)
        self.assertEqual(self.head(observer), ("pack-a-v1", 1))
        self.assertEqual(self.cas(), 1)
        self.assertEqual(self.cas(observer), 0)
        self.assertEqual(self.head(observer), ("pack-a-v2", 2))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE knowledge_target_heads SET dataset_version_id = 'pack-b-v1'")
        self.assertEqual(self.head(), ("pack-a-v2", 2))

    def test_failed_activation_rolls_back_pointer_membership_and_readiness(self) -> None:
        old_sid, old_cid = self.add_snapshot("old")
        new_sid, _ = self.add_snapshot("new", state="validated")
        self.link("pack-a-v1", old_sid)
        self.create_head()
        with self.assertRaisesRegex(RuntimeError, "injected activation failure"):
            with transaction(self.db):
                self.db.execute("UPDATE knowledge_snapshots SET state = 'ready' WHERE id = ?", (new_sid,))
                self.link("pack-a-v2", new_sid)
                self.assertEqual(self.cas(), 1)
                raise RuntimeError("injected activation failure")
        self.assertEqual(self.head(), ("pack-a-v1", 1))
        self.assertEqual(self.db.execute("SELECT state FROM knowledge_snapshots WHERE id = ?", (new_sid,)).fetchone()[0], "validated")
        self.assertEqual(self.db.execute("SELECT count(*) FROM knowledge_version_snapshots WHERE dataset_version_id = 'pack-a-v2'").fetchone()[0], 0)
        self.assertEqual([row[0] for row in self.scoped(old_sid)], [old_cid])
        self.assertEqual(self.scoped(new_sid), [])

    def test_another_connection_observes_complete_old_or_new_activation(self) -> None:
        old_sid, _ = self.add_snapshot("old")
        new_sid, new_cid = self.add_snapshot("new", state="validated")
        self.link("pack-a-v1", old_sid)
        self.create_head()
        observer = self.connect()
        self.addCleanup(observer.close)
        with transaction(self.db):
            self.db.execute("UPDATE knowledge_snapshots SET state = 'ready' WHERE id = ?", (new_sid,))
            self.link("pack-a-v2", new_sid)
            self.assertEqual(self.cas(), 1)
            self.assertEqual(self.head(observer), ("pack-a-v1", 1))
            self.assertEqual(self.scoped(new_sid, connection=observer), [])
        self.assertEqual(self.head(observer), ("pack-a-v2", 2))
        self.assertEqual([row[0] for row in self.scoped(new_sid, connection=observer)], [new_cid])
        # Previous content remains available to an explicitly pinned/selected old request.
        self.assertEqual(len(self.scoped(old_sid, connection=observer)), 1)

    def test_shared_membership_and_even_expired_pins_require_explicit_collection(self) -> None:
        # An empty synthetic snapshot isolates membership/pin FKs from chunk ownership.
        # It is not a fixture for production corpus-completeness validation.
        sid, _ = self.add_snapshot("ownership-only", content=None)
        self.link("pack-a-v1", sid)
        self.link("pack-b-v1", sid)
        self.db.execute("DELETE FROM knowledge_version_snapshots WHERE dataset_version_id = 'pack-a-v1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM knowledge_snapshots WHERE id = ?", (sid,))
        self.db.execute("DELETE FROM knowledge_version_snapshots WHERE dataset_version_id = 'pack-b-v1'")
        self.db.execute("INSERT INTO knowledge_snapshot_pins VALUES (?, 'retention', 'old-head', 1)", (sid,))
        # Expiration is a GC decision, not a database cascade that can delete evidence.
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM knowledge_snapshots WHERE id = ?", (sid,))
        self.db.execute("DELETE FROM knowledge_snapshot_pins WHERE snapshot_id = ? AND expires_at_epoch <= ?", (sid, 2))
        self.assertEqual(self.db.execute("DELETE FROM knowledge_snapshots WHERE id = ?", (sid,)).rowcount, 1)

    def test_chunk_cannot_be_deleted_or_reassigned_while_owned(self) -> None:
        first, cid = self.add_snapshot("first")
        second, _ = self.add_snapshot("second", content=None)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM document_chunks WHERE id = ?", (cid,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO knowledge_snapshot_chunks VALUES (?, ?, 'second.md', '{}', ?)",
                (second, cid, digest("motion")),
            )
        self.assertEqual(len(self.scoped(first)), 1)

    def test_job_pin_and_head_survive_connection_restart(self) -> None:
        sid, _ = self.add_snapshot("retained", content=None)
        self.db.execute("INSERT INTO knowledge_snapshot_pins VALUES (?, 'job', 'job-1', NULL)", (sid,))
        self.create_head()
        self.db.close()
        self.db = self.connect()
        self.assertEqual(self.head(), ("pack-a-v1", 1))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM knowledge_snapshots WHERE id = ?", (sid,))
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--sql-dir", type=Path, default=SQL_DIR)
    arguments, unittest_arguments = parser.parse_known_args()
    SQL_DIR = arguments.sql_dir.resolve()
    for filename in ("knowledge-snapshots.sqlite.sql", "retrieval-scoped.sqlite.sql"):
        if not (SQL_DIR / filename).is_file():
            raise SystemExit(f"Required SQL file is missing: {SQL_DIR / filename}")
    print(f"SQLite {sqlite3.sqlite_version}; synthetic parent contract; shipped SQL from {SQL_DIR}", flush=True)
    unittest.main(argv=[sys.argv[0], *unittest_arguments], verbosity=2)
