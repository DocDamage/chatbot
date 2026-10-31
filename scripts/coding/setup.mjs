import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tools = path.join(root, 'services/coding-tools');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (exit ${result.status}).`);
}
const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!fs.existsSync(npm)) throw new Error('Run setup with npm run setup:coding-tools.');
run(process.execPath, [npm, 'ci', '--prefix', tools, '--no-audit', '--no-fund']);
const runtimes = {};
for (const name of ['serena', 'aider']) {
  const directory = path.join(root, 'data/coding-tools/runtime', name);
  const python = path.join(directory, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (!fs.existsSync(python)) run('uv', ['venv', '--python', '3.12', directory]);
  run('uv', ['pip', 'sync', '--python', python, '--require-hashes', path.join(tools, `${name}.lock`)]);
  runtimes[name] = name === 'serena' ? path.join(directory, process.platform === 'win32' ? 'Scripts/serena.exe' : 'bin/serena') : python;
}
fs.writeFileSync(path.join(tools, 'runtime.json'), JSON.stringify({ node: process.execPath, serena: runtimes.serena, aiderPython: runtimes.aider,
  versions: { serena: '2.1.0', aider: '0.86.2', astGrep: '0.51.0', context7: '4.4.4' } }, null, 2) + '\n');
const envPath = path.join(root, '.env'); let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
env = /^CODING_TOOLS_ENABLED=.*$/m.test(env) ? env.replace(/^CODING_TOOLS_ENABLED=.*$/m, 'CODING_TOOLS_ENABLED=true') : env.trimEnd() + '\nCODING_TOOLS_ENABLED=true\n';
fs.writeFileSync(envPath, env);
console.log('Coding integrations installed and enabled. Restart the chatbot. Models run on local Ollama; Context7 queries its documentation service.');
