import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createBackup, defaultBackupDirectory, verifyRestore } from './backups.mjs';

const root = path.resolve(import.meta.dirname, '../..');
dotenv.config({ path: path.join(root, '.env') });
try {
  if (process.env.RAG_DATABASE_URL || process.env.DATABASE_URL) throw new Error('Local backup supports SQLite only. Use PostgreSQL backup tooling for a configured database URL.');
  const args = process.argv.slice(2);
  const value = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const directory = path.resolve(root, value('directory') || process.env.RAG_BACKUP_DIR || defaultBackupDirectory(root));
  if (args.includes('--verify')) {
    const manifests = fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => /^chatbot-.*\.json$/.test(name)).sort().reverse() : [];
    const manifest = value('manifest') || (manifests[0] && path.join(directory, manifests[0]));
    if (!manifest) throw new Error('No managed backup exists to restore and verify.');
    console.log(JSON.stringify(verifyRestore(manifest), null, 2));
  } else {
    const source = path.resolve(root, process.env.RAG_SQLITE_PATH || 'data/chatbot.db');
    const backup = await createBackup(source, directory, { keepDays: Number(value('keep-days') || 14), keepCount: Number(value('keep-count') || 30) });
    console.log('Knowledge DB backup complete');
    console.log(JSON.stringify(backup, null, 2));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
