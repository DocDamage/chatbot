import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';

// Explicit live verification against the user's loopback app; no model requests.
const base = 'http://127.0.0.1:3001';
const output = path.resolve('temp/rea-live-verification.json');
const session = await fetch(`${base}/api/auth/local-session`, { method: 'POST' });
assert.equal(session.status, 200, 'Start the chatbot in local loopback mode first.');
const { token } = await session.json();
const checks = [];
async function api(route, options = {}) {
  const response = await fetch(base + route, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`${route}: ${response.status} ${await response.text()}`);
  return response;
}
async function analyze(name, content, operation, procedure) {
  const form = new FormData(); form.append('artifact', new Blob([content]), name); form.append('operation', operation);
  if (procedure) form.append('procedure', procedure);
  const job = await (await api('/api/rea/upload', { method: 'POST', body: form })).json();
  const deadline = Date.now() + 330000;
  for (;;) {
    const current = await (await api(`/api/rea/jobs/${job.id}`)).json();
    if (!['running', 'queued'].includes(current.status)) {
      checks.push({ operation, target: name, id: job.id, status: current.status, error: current.error,
        tools: current.steps?.map(step => step.tool), evidenceIds: current.steps?.map(step => step.evidenceId).filter(Boolean), evidenceSha256: current.evidenceSha256 });
      assert.equal(current.status, 'completed', current.error);
      const evidence = await (await api(`/api/rea/jobs/${job.id}/evidence`)).json();
      assert.ok(evidence.records?.length > 0, 'Export must contain retained evidence records.');
      if (procedure) {
        const dossier = evidence.records.find(record => record.operation === 'analyze_function');
        assert.ok(typeof dossier?.normalized_result?.pseudocode === 'string' && dossier.normalized_result.pseudocode.trim(), 'The selected native function must contain actual decompiler output.');
        checks.at(-1).pseudocodeChars = dossier.normalized_result.pseudocode.length;
      }
      return evidence;
    }
    if (Date.now() > deadline) throw new Error(`Analysis timed out: ${job.id}`);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}
try {
  const status = await (await api('/api/rea/status')).json(); assert.ok(status.available);
  const source = Buffer.from('const fs = require("node:fs"); module.exports = name => fs.readFileSync(name, "utf8");');
  await analyze('rea-inert.js', source, 'javascript');
  const zip = new AdmZip(); zip.addFile('index.js', source); zip.addFile('package.json', Buffer.from('{"name":"rea-inert","main":"index.js"}'));
  await analyze('rea-inert.zip', zip.toBuffer(), 'archive');
  const model = Buffer.alloc(24); model.write('GGUF'); model.writeUInt32LE(3, 4);
  await analyze('rea-empty.gguf', model, 'model');
  if (process.platform === 'win32') {
    const executable = fs.readFileSync('C:/Windows/System32/where.exe');
    await analyze('where.exe', executable, 'pe');
    const managed = 'C:/Program Files/PowerShell/7/System.Management.Automation.dll';
    if (fs.existsSync(managed)) await analyze('System.Management.Automation.dll', fs.readFileSync(managed), 'managed');
    if (process.argv.includes('--native')) {
      const inventory = await analyze('where.exe', executable, 'native');
      const catalog = inventory.records.find(record => record.operation === 'list_procedures');
      const procedure = catalog?.normalized_result.find(row => row.address?.startsWith('0x') && !row.procedure?.external && !row.procedure?.thunk);
      assert.ok(procedure, 'Native catalog must expose an internal procedure.');
      await analyze('where.exe', executable, 'native', procedure.address);
    }
  }
  const chat = await (await api('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: `rea-verify-${Date.now()}`, message: '/rea status', mode: 'ask' }) })).json();
  assert.equal(chat.model, 'rea-local');
  checks.push({ operation: 'chat-command', status: 'completed' });
} finally {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ verifiedAt: new Date().toISOString(), checks }, null, 2) + '\n');
  console.log(JSON.stringify(checks.map(({ operation, status, error }) => ({ operation, status, error }))));
}
