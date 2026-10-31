import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Explicitly invoked live, local-only verification; never uses paid model providers.
const root = path.resolve(import.meta.dirname, '../..');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-daily-'));
const base = 'http://127.0.0.1:4317';
const logPath = path.join(root, 'temp/daily-live-server.log');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
let child;
let token;
const checks = [];
const sessionId = `daily-${Date.now()}`;

async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
  child = undefined;
}

async function start(failingProvider = false) {
  const output = fs.openSync(logPath, 'a');
  child = spawn(process.execPath, [path.join(root, 'dist/server/index.js')], {
    cwd: workspace, windowsHide: true, shell: false, stdio: ['ignore', output, output],
    env: { ...process.env, NODE_ENV: 'development', DEPLOYMENT_MODE: 'local', HOST: '127.0.0.1', PORT: '4317',
      LLM_PROVIDER: 'ollama', USE_OLLAMA: 'true', USE_HUGGINGFACE: 'false', CHAT_RUNTIME_ENABLED: 'true',
      OLLAMA_URL: failingProvider ? 'http://127.0.0.1:1' : process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen3:8b',
      RAG_SQLITE_PATH: path.join(workspace, 'chatbot.db'), DATABASE_URL: '', RAG_DATABASE_URL: '',
      RAG_PERSISTENCE: 'true', RAG_RETRIEVAL_MODE: 'database', DABOOK_ENABLED: 'false',
      KNOWLEDGE_BASE_DIR: path.join(workspace, 'empty'), PUBLIC_KNOWLEDGE_BASE_DIR: path.join(workspace, 'empty'),
      EAGER_KNOWLEDGE_LOAD: 'false', BACKGROUND_KNOWLEDGE_LOAD: 'false', EAGER_CODING_KNOWLEDGE_LOAD: 'false',
      BACKGROUND_CODING_KNOWLEDGE_LOAD: 'false', ENABLE_WEBSOCKET: 'false',
      ENABLE_MODEL_ROUTING: 'false', ENABLE_SEMANTIC_CACHE: 'false', ENABLE_REDIS_CACHE: 'false', REDIS_URL: '',
    },
  });
  fs.closeSync(output);
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Verification server exited: inspect ${logPath}`);
    try {
      const response = await fetch(`${base}${failingProvider ? '/health/live' : '/health/ready'}`, { signal: AbortSignal.timeout(2500) });
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, 'The isolated application did not become ready.');
  const response = await fetch(`${base}/api/auth/local-session`, { method: 'POST' });
  assert.equal(response.status, 200, 'Local authentication must work.');
  token = (await response.json()).token;
}

async function chat(message, route = '/api/chat') {
  const started = Date.now();
  const response = await fetch(`${base}${route}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, mode: 'ask' }), signal: AbortSignal.timeout(180000),
  });
  assert.equal(response.status, 200, `${route} failed with HTTP ${response.status}`);
  const result = await response.json();
  assert(result.model.startsWith('ollama:'), 'A real local model must answer.');
  assert(result.traceId, 'The canonical runtime must handle this request.');
  return { ...result, wallTimeMs: Date.now() - started };
}

try {
  await start();
  const first = await chat('My project is called Copper Finch. Remember it for this conversation. Reply briefly.');
  checks.push({ check: 'real local generation', passed: true, latencyMs: first.wallTimeMs });
  const followup = await chat('What is my project called? Reply with the name only.');
  assert.match(followup.response, /Copper Finch/i);
  checks.push({ check: 'multi-turn recall', passed: true, latencyMs: followup.wallTimeMs });

  const form = new FormData();
  form.append('file', new Blob(['Aurora Observatory reserve identifier: cobalt lantern 7419. The telescope inspection day is Thursday.'], { type: 'text/plain' }), 'daily-verification-note.txt');
  const upload = await fetch(`${base}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(upload.status, 200, 'Document upload must ingest successfully.');
  assert((await upload.json()).chunks > 0, 'The document must produce indexed chunks.');
  const answer = await chat('According to the uploaded note, what is the Aurora Observatory reserve identifier?');
  assert.match(answer.response, /cobalt lantern 7419/i);
  assert(answer.citations.length > 0, 'A document answer must include verified source references.');
  checks.push({ check: 'upload, retrieval and citations', passed: true, latencyMs: answer.wallTimeMs });

  await stop();
  await start();
  const restored = await chat('What is my project called? Reply with the name only.', '/api/v1/chat');
  assert.match(restored.response, /Copper Finch/i);
  const documentAfterRestart = await chat('According to the note, what is the Aurora Observatory reserve identifier?', '/api/v2/chat');
  assert.match(documentAfterRestart.response, /cobalt lantern 7419/i);
  assert(documentAfterRestart.citations.length > 0);
  const history = await fetch(`${base}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } });
  assert((await history.json()).conversations.some(conversation => conversation.sessionId === sessionId && conversation.messageCount === 10));
  checks.push({ check: 'real process restart, v1/v2 routes, history and document persistence', passed: true });

  await stop();
  await start(true);
  const failure = await fetch(`${base}/api/chat`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'provider-failure', message: 'Hello' }) });
  assert.equal(failure.status, 503);
  assert.equal((await failure.json()).error.code, 'MODEL_UNAVAILABLE');
  assert.equal((await fetch(`${base}/health/ready`)).status, 503);
  checks.push({ check: 'provider failure and degraded readiness', passed: true });
  console.log(JSON.stringify({ provider: 'ollama', checks }, null, 2));
  fs.writeFileSync(path.join(root, 'temp/daily-live-verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), provider: 'ollama', checks }, null, 2));
} finally {
  await stop();
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  assert(workspace.startsWith(temporaryRoot), 'Refusing cleanup outside the temporary directory.');
  fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
