import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const root = path.resolve(import.meta.dirname, '../..');
process.chdir(root);
const envPath = path.join(root, '.env');
dotenv.config({ path: envPath });
const baseUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname)) throw new Error('Local setup requires a loopback Ollama URL.');

async function models() {
  const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('Ollama did not return its model list.');
  return (await response.json()).models.map(model => model.name);
}

let installed;
try { installed = await models(); }
catch {
  const windowsExe = path.join(process.env.LOCALAPPDATA || '', 'Programs/Ollama/ollama.exe');
  const executable = process.platform === 'win32' && fs.existsSync(windowsExe) ? windowsExe : 'ollama';
  const daemon = spawn(executable, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
  let launchError;
  daemon.on('error', error => { launchError = error; });
  daemon.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (launchError) throw new Error('Ollama could not start. Install Ollama, then run setup:local again.');
    try { installed = await models(); break; } catch { /* Wait for the local daemon. */ }
  }
  if (!installed) throw new Error('Ollama did not start within 15 seconds.');
}

const model = process.env.OLLAMA_MODEL || (installed.includes('qwen3:8b') ? 'qwen3:8b' : installed.find(name => !/embed/i.test(name)));
if (!model || !installed.includes(model)) throw new Error(`Selected chat model is not installed: ${model || '(none)'}. Install a model in Ollama and retry.`);
if (!fs.existsSync(envPath)) {
  let template = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const values = {
    NODE_ENV: 'development', DEPLOYMENT_MODE: 'local', HOST: '127.0.0.1', PORT: '3001',
    JWT_SECRET: randomBytes(48).toString('hex'), CHAT_RUNTIME_ENABLED: 'true',
    LLM_PROVIDER: 'ollama', USE_OLLAMA: 'true', OLLAMA_URL: baseUrl, OLLAMA_MODEL: model,
    LLM_KNOWLEDGE_FALLBACK: 'true', ONLINE_KNOWLEDGE_FALLBACK: 'false',
    ENABLE_MODEL_ROUTING: 'false', ENABLE_SEMANTIC_CACHE: 'false',
    ENABLE_REDIS_CACHE: 'false', REDIS_URL: '', RAG_RETRIEVAL_MODE: 'database',
    CORS_ORIGIN: 'http://127.0.0.1:3001,http://localhost:3001,http://localhost:3000,http://127.0.0.1:3000',
    DABOOK_ENABLED: String(fs.existsSync(path.join(root, 'services/dabook/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'))),
  };
  if (installed.includes('nomic-embed-text:v1.5')) {
    values.EMBEDDING_PROVIDER = 'ollama';
    values.EMBEDDING_MODEL = 'nomic-embed-text:v1.5';
  }
  for (const [name, value] of Object.entries(values)) template = template.replace(new RegExp(`^${name}=.*$`, 'm'), () => `${name}=${value}`);
  fs.writeFileSync(envPath, template, { flag: 'wx', mode: 0o600 });
  console.log('Created ignored .env for local Ollama with a generated signing secret.');
} else {
  console.log('Existing .env preserved.');
}
console.log(`Ollama is available; selected chat model: ${model}. No model downloads or paid API calls were made.`);
