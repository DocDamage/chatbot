import 'dotenv/config';
import path from 'node:path';
import Sqlite from 'better-sqlite3';

const checks = {};
try {
  const response = await fetch(`${process.env.OLLAMA_URL || 'http://127.0.0.1:11434'}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const data = await response.json();
  checks.model = response.ok && data.models.some(model => model.name === process.env.OLLAMA_MODEL);
} catch { checks.model = false; }
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
console.log(JSON.stringify(checks, null, 2));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
