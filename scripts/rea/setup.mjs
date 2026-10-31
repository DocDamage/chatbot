import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(root, 'services/rea');
const candidates = [process.env.REA_NODE_PATH, process.execPath,
  path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')].filter(Boolean);
const supported = version => {
  const [major, minor, patch] = version.replace(/^v/, '').split('.').map(Number);
  return (major === 22 && (minor > 23 || minor === 23 && patch >= 4))
    || (major === 24 && (minor > 22 || minor === 22 && patch >= 1))
    || major > 26 || major === 26 && (minor > 12 || minor === 12 && patch >= 1);
};
const node = candidates.find(candidate => {
  const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true });
  return result.status === 0 && supported(result.stdout.trim());
});
if (!node) throw new Error('REA 6.8 needs Node ^22.23.4, ^24.22.1, or >=26.12.1. Install a compatible runtime and set REA_NODE_PATH.');
const npm = process.env.npm_execpath || path.resolve(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!fs.existsSync(npm)) throw new Error('Run this script with npm run setup:rea so the npm CLI can be located.');
const install = spawnSync(node, [npm, 'ci', '--prefix', runtime, '--no-audit', '--no-fund'], { stdio: 'inherit', windowsHide: true });
if (install.status !== 0) process.exit(install.status || 1);
fs.writeFileSync(path.join(runtime, 'runtime.json'), JSON.stringify({ node, version: '6.8.0' }, null, 2) + '\n');
const envPath = path.join(root, '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
env = /^REA_ENABLED=.*$/m.test(env) ? env.replace(/^REA_ENABLED=.*$/m, 'REA_ENABLED=true') : env.trimEnd() + '\nREA_ENABLED=true\n';
fs.writeFileSync(envPath, env);
console.log('REA 6.8.0 installed and enabled locally. Restart the chatbot to load it.');
