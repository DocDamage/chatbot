"""Executable SQL contract checks; synthetic data only, no application DB access."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "sql" / "002_game_runs.sqlite.sql"


class RunSchemaTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = str(Path(self.directory.name) / "test.db")
        self.db = sqlite3.connect(self.database, timeout=0.02)
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(MIGRATION.read_text())
        self.db.execute("INSERT INTO game_projects VALUES (?,?,?,?,?,?,?,?,?)",
                        ("p1", "owner", "tenant", "F:/Game", "godot", "{}", "a" * 64, 10, 10))
        self.db.execute("INSERT INTO game_project_leases(project_key) VALUES (?)", ("p1",))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.directory.cleanup()

    def add_run(self, run_id="r1", key="idempotency-1"):
        self.db.execute("""INSERT INTO game_runs (
          run_id,project_key,owner_id,tenant_id,idempotency_key,request_digest,
          phase,revision,repairs_started,max_repair_attempts,state_json,
          created_at_ms,updated_at_ms,deadline_at_ms)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
          (run_id, "p1", "owner", "tenant", key, "b" * 64, "queued", 0, 0, 2, "{}", 10, 10, 1000))
        self.db.commit()

    def test_idempotency_unique_and_invalid_phase_rejected(self):
        self.add_run()
        with self.assertRaises(sqlite3.IntegrityError):
            self.add_run("r2", "idempotency-1")
        self.db.rollback()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE game_runs SET phase='looks-good' WHERE run_id='r1'")
        self.db.rollback()

    def test_compare_and_swap_and_event_are_one_transaction(self):
        self.add_run()
        self.db.execute("BEGIN IMMEDIATE")
        count = self.db.execute("""UPDATE game_runs SET phase=?,revision=revision+1,updated_at_ms=?
          WHERE run_id=? AND revision=? AND owner_id=? AND tenant_id=?""",
          ("profiling", 20, "r1", 0, "owner", "tenant")).rowcount
        self.assertEqual(count, 1)
        self.db.execute("INSERT INTO game_run_events VALUES (?,?,?,?,?)", ("r1", 1, "e1", json.dumps({"type": "start"}), 20))
        self.db.commit()
        self.assertEqual(self.db.execute("UPDATE game_runs SET revision=revision+1 WHERE run_id=? AND revision=?", ("r1", 0)).rowcount, 0)
        self.db.rollback()
        self.db.execute("BEGIN IMMEDIATE")
        self.db.execute("UPDATE game_runs SET revision=2,phase='retrieving' WHERE run_id='r1'")
        try:
            self.db.execute("INSERT INTO game_run_events VALUES (?,?,?,?,?)", ("r1", 2, "e1", "{}", 30))
        except sqlite3.IntegrityError:
            self.db.rollback()
        self.assertEqual(self.db.execute("SELECT revision,phase FROM game_runs").fetchone(), (1, "profiling"))

    def test_fence_increases_and_old_holder_cannot_release_new_lease(self):
        self.add_run()
        self.add_run("r2", "idempotency-2")
        acquired = self.db.execute("""UPDATE game_project_leases
          SET holder_run_id=?,fence=fence+1,expires_at_ms=?,updated_at_ms=?
          WHERE project_key=? AND holder_run_id IS NULL RETURNING fence""", ("r1", 100, 20, "p1")).fetchone()
        self.assertEqual(acquired, (1,))
        self.db.commit()
        # Expiry alone is NOT takeover authority. The host first proves old processes
        # are stopped/reconciled; this test models that completed recovery decision.
        self.db.execute("UPDATE game_project_leases SET holder_run_id=NULL WHERE project_key=? AND holder_run_id=? AND fence=?", ("p1", "r1", 1))
        acquired = self.db.execute("""UPDATE game_project_leases
          SET holder_run_id=?,fence=fence+1,expires_at_ms=?,updated_at_ms=?
          WHERE project_key=? AND holder_run_id IS NULL RETURNING fence""", ("r2", 200, 110, "p1")).fetchone()
        self.assertEqual(acquired, (2,))
        changed = self.db.execute("UPDATE game_project_leases SET holder_run_id=NULL WHERE project_key=? AND holder_run_id=? AND fence=?", ("p1", "r1", 1)).rowcount
        self.assertEqual(changed, 0)
        self.db.commit()

    def test_sqlite_writer_conflict_is_visible(self):
        self.add_run()
        other = sqlite3.connect(self.database, timeout=0.02)
        try:
            self.db.execute("BEGIN IMMEDIATE")
            with self.assertRaises(sqlite3.OperationalError):
                other.execute("BEGIN IMMEDIATE")
        finally:
            self.db.rollback()
            other.close()

    def test_foreign_keys_reject_orphan_artifacts(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO game_artifacts VALUES (?,?,?,?,?,?,?,?)",
                            ("a1", "absent-run", None, "evidence", "evidence/result.json", "c" * 64, 20, 30))
        self.db.rollback()

    def test_run_cannot_change_owner_away_from_enrolled_project(self):
        self.add_run()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE game_runs SET owner_id='other-owner' WHERE run_id='r1'")
        self.db.rollback()

    def test_artifact_cannot_reference_another_runs_proposal(self):
        self.add_run()
        self.add_run("r2", "idempotency-2")
        self.db.execute("INSERT INTO game_proposals VALUES (?,?,?,?,?,?,?)",
                        ("proposal-1", "r1", "p1", "d" * 64, "{}", "a" * 64, 20))
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO game_artifacts VALUES (?,?,?,?,?,?,?,?)",
                            ("a2", "r2", "proposal-1", "evidence", "result.json", "c" * 64, 20, 30))
        self.db.rollback()


if __name__ == '__main__':
    unittest.main()
