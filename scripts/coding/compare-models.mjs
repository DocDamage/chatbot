import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import os from 'node:os';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
process.chdir(root);
dotenv.config({ path: path.join(root, '.env') });
const require = createRequire(import.meta.url);
const base = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Comparison requires local Ollama.');
const requested = process.argv.find(arg => arg.startsWith('--models='))?.slice(9).split(',') || ['qwen3:8b', 'qwen3-coder:30b'];
const probesOnly = process.argv.includes('--probes-only');
if (requested.length !== 2 || new Set(requested).size !== 2) throw new Error('Choose two distinct installed models.');
const output = path.resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || path.join(root, 'data/coding-tools', `comparison-${Date.now()}`));
fs.mkdirSync(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), contextTokens: 16384, models: [],
  mode: probesOnly ? 'throughput-only' : 'integration-and-throughput',
  host: { cpu: os.cpus()[0]?.model, ramBytes: os.totalmem(), node: process.versions.node, platform: process.platform },
  sourceHashes: Object.fromEntries(['scripts/coding/verify.ts', 'src/core/coding/integrations/AiderAdapter.ts',
    'src/core/coding/integrations/Context7Adapter.ts', 'src/core/coding/verification/ModelRepairProposal.ts'].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex')])),
  limitations: [probesOnly ? 'Throughput-only run: no coding correctness assertions are executed.' : 'One complete integration run per model, isolated fixtures; not a general coding benchmark.',
    'Integration runs retain each model’s existing thinking settings. Throughput probes disable thinking for both.',
    'Residency fields are server-reported allocations, not measurements of physical GPU memory.',
    'Tool/network startup contributes to end-to-end timings. No default model setting is changed.'] };
const save = () => fs.writeFileSync(path.join(output, 'comparison.json'), JSON.stringify(report, null, 2));
async function post(route, body) {
  const response = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(600000) });
  if (!response.ok) throw new Error(`Ollama ${route}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}
async function integration(model, filename, logPath) {
  const fd = fs.openSync(logPath, 'w');
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'scripts/coding/verify.ts', `--report=${filename}`], {
        cwd: root, windowsHide: true, shell: false, stdio: ['ignore', fd, fd],
        env: { ...process.env, CODING_TOOLS_ENABLED: 'true', CODING_OLLAMA_MODEL: model, OLLAMA_MODEL: model, CODING_CONTEXT_TOKENS: '16384' },
      });
      const timer = setTimeout(() => {
        if (process.platform === 'win32' && child.pid) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
        child.kill();
        reject(new Error('Integration evaluation exceeded its 60-minute limit.'));
      }, 3600000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); resolve(code); });
    });
  } finally { fs.closeSync(fd); }
}
try {
  const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Could not inspect installed models.');
  let installed = (await response.json()).models;
  for (const [index, model] of requested.entries()) {
    const tags = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!tags.ok) throw new Error('Could not refresh installed models.');
    installed = (await tags.json()).models;
    if (!installed.some(item => item.name === model)) throw new Error(`Install ${model} in Ollama before comparing. No models were downloaded by this command.`);
    console.log(`Evaluating ${model}; logs: ${output}`);
    const result = { model, modelDigest: installed.find(item => item.name === model).digest, probes: [], status: 'running' };
    report.models.push(result); save();
    try {
      const probeBody = { model, stream: false, think: false, keep_alive: '10m', options: { num_ctx: 16384, num_predict: 256, temperature: 0, seed: 42 } };
      const warm = await post('/api/generate', { ...probeBody, prompt: 'Reply with READY only.', options: { ...probeBody.options, num_predict: 8 } });
      result.loadMs = warm.load_duration / 1000000;
      for (const prompt of [
        'Write a CommonJS function that returns a new array of unique integers preserving first occurrence order. Include node:test cases. Output code only.',
        'Write a TypeScript function that parses a finite decimal number or returns null. Reject empty strings, Infinity and partial numbers. Include test examples. Output code only.',
        'Explain why array.sort() mutates its argument and demonstrate an immutable numeric ascending sort with a test.',
      ]) {
        const started = Date.now();
        const generated = await post('/api/generate', { ...probeBody, prompt });
        if (!generated.response?.trim() || !generated.eval_count || !generated.eval_duration) throw new Error('Ollama returned no usable generation metrics.');
        result.probes.push({ wallTimeMs: Date.now() - started, outputTokens: generated.eval_count,
          tokensPerSecond: generated.eval_count * 1e9 / generated.eval_duration,
          promptTokens: generated.prompt_eval_count, promptMs: generated.prompt_eval_duration / 1e6,
          finishReason: generated.done_reason, output: generated.response });
        save();
      }
      const ps = await fetch(`${base}/api/ps`);
      if (ps.ok) result.residency = (await ps.json()).models.map(item => ({ name: item.name, sizeBytes: item.size, vramBytes: item.size_vram }));
      if (probesOnly) { result.status = 'measured'; continue; }
      const filename = path.join(output, `model-${index + 1}-verification.json`);
      const started = Date.now();
      result.exitCode = await integration(model, filename, path.join(output, `model-${index + 1}.log`));
      result.integrationMs = Date.now() - started;
      if (!fs.existsSync(filename)) throw new Error('Integration runner did not produce a report.');
      const verification = JSON.parse(fs.readFileSync(filename, 'utf8'));
      result.checks = verification.checks;
      result.passed = verification.checks.filter(check => check.status === 'passed').length;
      result.failed = verification.checks.filter(check => check.status !== 'passed').length;
      result.status = result.exitCode === 0 && result.passed === 9 && result.failed === 0 ? 'passed' : 'failed';
    } catch (error) { result.status = 'failed'; result.error = error.message; }
    finally { await post('/api/generate', { model, keep_alive: 0 }).catch(() => {}); save(); }
    console.log(`${model}: ${result.status}, ${result.passed ?? 0}/9 integration cases passed`);
  }
  report.finishedAt = new Date().toISOString();
  report.status = report.models.every(model => model.status === (probesOnly ? 'measured' : 'passed')) ? (probesOnly ? 'measured' : 'passed') : 'failed';
  save();
  console.log(JSON.stringify({ status: report.status, report: path.join(output, 'comparison.json') }));
  if (report.status === 'failed') process.exitCode = 1;
} catch (error) { report.status = 'failed'; report.error = error.message; save(); console.error(error.message); process.exitCode = 1; }
