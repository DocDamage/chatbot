import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import Sqlite from 'better-sqlite3';
import { defaultBackupDirectory, validateBackup } from './backups.mjs';

const checks = {};
checks.builtServer = fs.existsSync(path.join(process.cwd(), 'dist/server/index.js'));
try {
  const response = await fetch(`${process.env.OLLAMA_URL || 'http://127.0.0.1:11434'}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const data = await response.json();
  checks.model = response.ok && data.models.some(model => model.name === process.env.OLLAMA_MODEL);
  if (process.env.CODING_TOOLS_ENABLED === 'true') {
    const codingModel = process.env.CODING_OLLAMA_MODEL || process.env.OLLAMA_MODEL || 'qwen3:8b';
    checks.codingModel = response.ok && data.models.some(model => model.name === codingModel);
  }
} catch { checks.model = false; if (process.env.CODING_TOOLS_ENABLED === 'true') checks.codingModel = false; }
if (process.env.CODING_TOOLS_ENABLED === 'true') {
  try {
    const runtime = JSON.parse(fs.readFileSync(path.resolve('services/coding-tools/runtime.json'), 'utf8'));
    const files = ['node', 'serena', 'aiderPython'].map(name => runtime[name]);
    files.push(path.resolve('services/coding-tools/node_modules/@upstash/context7-mcp/dist/index.js'));
    files.push(path.resolve('services/coding-tools/node_modules/@ast-grep/cli', process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep'));
    checks.codingRuntimes = files.every(file => typeof file === 'string' && fs.existsSync(file));
  } catch { checks.codingRuntimes = false; }
}
try {
  const database = new Sqlite(path.resolve(process.env.RAG_SQLITE_PATH || 'data/chatbot.db'), { readonly: true, fileMustExist: true });
  checks.database = database.pragma('quick_check').every(row => row.quick_check === 'ok');
  checks.conversationState = !!database.prepare("SELECT name FROM sqlite_master WHERE name = 'conversation_states'").get();
  database.close();
} catch { checks.database = false; }
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || '3001'}/health/ready`, { signal: AbortSignal.timeout(3000) });
  checks.application = response.ok;
} catch { checks.application = false; }
try {
  const directory = path.resolve(process.env.RAG_BACKUP_DIR || defaultBackupDirectory(process.cwd()));
  const newest = fs.readdirSync(directory).filter(file => /^chatbot-.*\.json$/.test(file)).sort().at(-1);
  const backup = validateBackup(path.join(directory, newest || 'missing'));
  const source = path.resolve(process.env.RAG_SQLITE_PATH || 'data/chatbot.db');
  const age = Date.now() - Date.parse(backup.createdAt);
  checks.recentVerifiedBackup = path.relative(source, backup.sourcePath) === '' && age >= 0 && age < 48 * 3600000;
} catch { checks.recentVerifiedBackup = false; }
console.log(JSON.stringify(checks, null, 2));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
