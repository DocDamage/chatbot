import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function main(): Promise<void> {
  if (process.env.RAG_DATABASE_URL || process.env.DATABASE_URL) {
    throw new Error('kb:backup currently supports the local SQLite knowledge database. Use your PostgreSQL backup tooling for RAG_DATABASE_URL.');
  }

  const dbPath = path.resolve(process.env.RAG_SQLITE_PATH || path.join(process.cwd(), 'data', 'chatbot.db'));
  const backupDir = path.resolve(process.env.RAG_BACKUP_DIR || path.join(process.cwd(), 'data', 'backups'));

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Knowledge database not found: ${dbPath}`);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const backupPath = path.join(backupDir, `chatbot-${timestamp}.db`);
  const manifestPath = path.join(backupDir, `chatbot-${timestamp}.json`);
  const sourceSizeBytes = fs.statSync(dbPath).size;
  const availableBytes = availableDiskBytes(backupDir);

  if (availableBytes !== undefined && availableBytes < sourceSizeBytes * 1.05) {
    throw new Error([
      `Not enough free disk space for SQLite backup.`,
      `Database size: ${formatBytes(sourceSizeBytes)}.`,
      `Available: ${formatBytes(availableBytes)}.`,
      `Set RAG_BACKUP_DIR to a drive with more free space, or free space and retry.`
    ].join(' '));
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('better-sqlite3');
  const db = sqlite(dbPath);

  try {
    db.pragma('wal_checkpoint(PASSIVE)');
    db.exec(`VACUUM INTO '${escapeSqliteString(backupPath)}'`);
  } finally {
    db.close();
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    sourcePath: dbPath,
    backupPath,
    sizeBytes: fs.statSync(backupPath).size,
    sourceSizeBytes,
    method: 'sqlite-vacuum-into'
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Knowledge DB backup complete`);
  console.log(`Backup: ${backupPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Size: ${manifest.sizeBytes} bytes`);
}

function escapeSqliteString(value: string): string {
  return value.replace(/'/g, "''");
}

function availableDiskBytes(directoryPath: string): number | undefined {
  try {
    const stats = fs.statfsSync(directoryPath);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return undefined;
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

main().catch((error: any) => {
  console.error(error.message);
  process.exit(1);
});
