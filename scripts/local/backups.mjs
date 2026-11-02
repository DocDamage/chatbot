import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import Sqlite from 'better-sqlite3';

const format = 'chatbot-sqlite-backup-v1';
function digest(file) {
  const hash = crypto.createHash('sha256'), buffer = Buffer.alloc(1048576), fd = fs.openSync(file, 'r');
  try {
    let length;
    while ((length = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, length));
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}
const plainFile = file => fs.existsSync(file) && fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink();
const samePath = (a, b) => process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);

export function defaultBackupDirectory(root) {
  const id = crypto.createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 8);
  return process.platform === 'win32' && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Chatbot', 'backups', id) : path.join(root, 'data/backups');
}

export function validateBackup(manifestPath) {
  if (!plainFile(manifestPath)) throw new Error('Backup manifest must be a regular file.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const name = path.basename(manifestPath, '.json');
  if (manifest.format !== format || !/^chatbot-\d{8}T\d{9}Z-[a-f0-9]{8}$/.test(name)
    || manifest.file !== `${name}.db` || !/^[a-f0-9]{64}$/.test(manifest.sha256)
    || !Number.isFinite(Date.parse(manifest.createdAt)) || typeof manifest.sourcePath !== 'string') throw new Error('Invalid managed backup manifest.');
  const file = path.join(path.dirname(manifestPath), manifest.file);
  if (!plainFile(file) || fs.statSync(file).size !== manifest.sizeBytes || digest(file) !== manifest.sha256) throw new Error('Backup integrity/hash verification failed.');
  const db = new Sqlite(file, { readonly: true, fileMustExist: true });
  try {
    if (!db.pragma('quick_check').every(row => row.quick_check === 'ok')) throw new Error('SQLite backup integrity check failed.');
  } finally { db.close(); }
  return { ...manifest, manifestPath, backupPath: file };
}

export function pruneBackups(directory, sourcePath, { keepDays = 14, keepCount = 30, now = Date.now() } = {}) {
  if (!Number.isInteger(keepDays) || keepDays < 1 || !Number.isInteger(keepCount) || keepCount < 1) throw new Error('Retention must keep at least one day and one backup.');
  const backups = [];
  for (const name of fs.readdirSync(directory)) {
    if (!name.startsWith('chatbot-') || !name.endsWith('.json')) continue;
    try {
      const backup = validateBackup(path.join(directory, name));
      if (samePath(backup.sourcePath, sourcePath)) backups.push(backup);
    } catch { /* Unknown, damaged and unpaired files are retained for inspection. */ }
  }
  backups.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.file.localeCompare(a.file));
  const removed = [];
  for (let i = 1; i < backups.length; i++) {
    const backup = backups[i];
    if (i < keepCount && Date.parse(backup.createdAt) >= now - keepDays * 86400000) continue;
    // Delete only verified direct-child pairs for this source, always retaining its newest backup.
    fs.unlinkSync(backup.backupPath);
    fs.unlinkSync(backup.manifestPath);
    removed.push(backup.file);
  }
  return removed;
}

export async function createBackup(sourcePath, directory, options = {}) {
  for (const [name, fallback] of [['keepDays', 14], ['keepCount', 30]]) {
    if (!Number.isInteger(options[name] ?? fallback) || (options[name] ?? fallback) < 1) throw new Error('Retention must keep at least one day and one backup.');
  }
  sourcePath = path.resolve(sourcePath);
  directory = path.resolve(directory);
  if (!plainFile(sourcePath)) throw new Error(`Database not found or not a regular file: ${sourcePath}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, '.chatbot-backup.lock');
  if (fs.existsSync(lock)) {
    const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
    if (!Number.isInteger(owner.pid) || owner.pid < 1) throw new Error('Invalid backup lock; inspect it before retrying.');
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
    if (alive) throw new Error('Another backup is running.');
    fs.unlinkSync(lock);
  }
  const lockFd = fs.openSync(lock, 'wx', 0o600);
  fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid }));
  const createdAt = new Date(options.now ?? Date.now()).toISOString();
  const name = `chatbot-${createdAt.replace(/[-:.]/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
  const temporary = path.join(directory, `${name}.partial`);
  const backupPath = path.join(directory, `${name}.db`);
  const manifestPath = path.join(directory, `${name}.json`);
  try {
    const stats = fs.statfsSync(directory);
    if (Number(stats.bavail) * Number(stats.bsize) < fs.statSync(sourcePath).size * 1.1 + 1048576) throw new Error('Insufficient free space for backup.');
    const db = new Sqlite(sourcePath, { readonly: true, fileMustExist: true });
    try { await db.backup(temporary); } finally { db.close(); }
    const copy = new Sqlite(temporary, { readonly: true, fileMustExist: true });
    try {
      if (!copy.pragma('quick_check').every(row => row.quick_check === 'ok')) throw new Error('New backup failed SQLite integrity verification.');
    } finally { copy.close(); }
    fs.renameSync(temporary, backupPath);
    fs.writeFileSync(manifestPath, JSON.stringify({ format, createdAt, sourcePath, file: path.basename(backupPath),
      sizeBytes: fs.statSync(backupPath).size, sha256: digest(backupPath), method: 'sqlite-online-backup' }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const backup = validateBackup(manifestPath);
    return { ...backup, removed: pruneBackups(directory, sourcePath, options) };
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(lockFd);
    fs.unlinkSync(lock);
  }
}

export function verifyRestore(manifestPath) {
  const backup = validateBackup(path.resolve(manifestPath));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-restore-'));
  const restored = path.join(directory, 'restored.db');
  try {
    fs.copyFileSync(backup.backupPath, restored, fs.constants.COPYFILE_EXCL);
    if (digest(restored) !== backup.sha256) throw new Error('Restored copy differs from backup.');
    const db = new Sqlite(restored, { readonly: true, fileMustExist: true });
    try {
      if (!db.pragma('quick_check').every(row => row.quick_check === 'ok')) throw new Error('Restored database is corrupt.');
      return { status: 'passed', manifestPath: backup.manifestPath,
        tables: db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name) };
    } finally { db.close(); }
  } finally {
    if (!directory.startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unsafe restore cleanup path.');
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
