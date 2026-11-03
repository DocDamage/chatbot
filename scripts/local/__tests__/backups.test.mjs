import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Sqlite from 'better-sqlite3';
import { createBackup, validateBackup, pruneBackups, verifyRestore } from '../backups.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-backup-test-'));
  const source = path.join(root, 'source.db'), directory = path.join(root, 'backups');
  const db = new Sqlite(source);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE conversations (id TEXT PRIMARY KEY, message TEXT)');
  t.after(() => {
    db.close();
    assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  return { root, source, directory, db };
}

test('online backup preserves committed WAL data and restores a separate database', async t => {
  const f = fixture(t);
  f.db.prepare('INSERT INTO conversations VALUES (?, ?)').run('saved-session', 'persistent message');
  assert(fs.statSync(`${f.source}-wal`).size > 0);
  const backup = await createBackup(f.source, f.directory);
  f.db.prepare('INSERT INTO conversations VALUES (?, ?)').run('later-session', 'newer data');
  const copy = new Sqlite(backup.backupPath, { readonly: true });
  try { assert.deepEqual(copy.prepare('SELECT * FROM conversations').all(), [{ id: 'saved-session', message: 'persistent message' }]); }
  finally { copy.close(); }
  assert.equal(verifyRestore(backup.manifestPath).status, 'passed');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM conversations').get().n, 2);
});

test('tampered backup is rejected without touching the source', async t => {
  const f = fixture(t), backup = await createBackup(f.source, f.directory);
  fs.appendFileSync(backup.backupPath, 'corrupt');
  assert.throws(() => verifyRestore(backup.manifestPath), /integrity/);
  assert.equal(f.db.pragma('quick_check')[0].quick_check, 'ok');
});

test('retention keeps newest and unrelated, invalid and other-source files', async t => {
  const f = fixture(t);
  const now = Date.now();
  const old = await createBackup(f.source, f.directory, { now: now - 20 * 86400000, keepDays: 365 });
  const other = path.join(f.root, 'other.db');
  const db = new Sqlite(other); db.exec('CREATE TABLE other (id INTEGER)'); db.close();
  const foreign = await createBackup(other, f.directory, { now: now - 19 * 86400000, keepDays: 365 });
  fs.writeFileSync(path.join(f.directory, 'personal.db'), 'do not remove');
  fs.writeFileSync(path.join(f.directory, 'chatbot-invalid.json'), '{}');
  const newest = await createBackup(f.source, f.directory, { now, keepDays: 14 });
  assert.deepEqual(newest.removed, [old.file]);
  assert(fs.existsSync(foreign.backupPath));
  assert(fs.existsSync(path.join(f.directory, 'personal.db')));
  assert(fs.existsSync(path.join(f.directory, 'chatbot-invalid.json')));
  assert.equal(validateBackup(newest.manifestPath).sha256, newest.sha256);
  assert.deepEqual(pruneBackups(f.directory, f.source, { keepCount: 1, now: now + 50 * 86400000 }), []);
});

test('concurrent backup lock and unsafe manifest paths fail closed', async t => {
  const f = fixture(t);
  fs.mkdirSync(f.directory);
  const lock = path.join(f.directory, '.chatbot-backup.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
  await assert.rejects(createBackup(f.source, f.directory), /Another backup/);
  fs.unlinkSync(lock);
  const backup = await createBackup(f.source, f.directory);
  const manifest = JSON.parse(fs.readFileSync(backup.manifestPath));
  manifest.file = '../source.db';
  fs.writeFileSync(backup.manifestPath, JSON.stringify(manifest));
  assert.throws(() => validateBackup(backup.manifestPath), /Invalid managed/);
});

test('count retention removes only the oldest verified backup inside the age window', async t => {
  const f = fixture(t), now = Date.now();
  const first = await createBackup(f.source, f.directory, { now: now - 2000 });
  const second = await createBackup(f.source, f.directory, { now: now - 1000 });
  const third = await createBackup(f.source, f.directory, { now, keepCount: 2 });
  assert.deepEqual(third.removed, [first.file]);
  assert(fs.existsSync(second.backupPath));
  assert(fs.existsSync(third.backupPath));
});
