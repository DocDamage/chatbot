import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const root = path.resolve(import.meta.dirname, '../..');
process.chdir(root);
dotenv.config({ path: path.join(root, '.env') });
const directory = path.join(root, 'data/local-runtime');
fs.mkdirSync(directory, { recursive: true });
const marker = path.join(directory, 'supervisor.json');
const log = path.join(directory, 'startup.log');
let child;
let stopping = false;
let owned = false;
function record(message) {
  if (fs.existsSync(log) && fs.statSync(log).size > 5 * 1048576) {
    fs.copyFileSync(log, `${log}.previous`);
    fs.truncateSync(log);
  }
  fs.appendFileSync(log, message);
}
function run(file) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [file], { cwd: root, env: process.env, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, childPid: child.pid, root, startedAt: new Date().toISOString() }));
    child.stdout.on('data', data => record(data));
    child.stderr.on('data', data => record(data));
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 || stopping ? resolve() : reject(new Error(`${path.basename(file)} exited ${code ?? signal}.`)));
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; child?.kill(); });
try {
  if (fs.existsSync(marker)) {
    const prior = JSON.parse(fs.readFileSync(marker, 'utf8'));
    let alive = false;
    if (prior.root === root && Number.isInteger(prior.pid) && prior.pid > 0) {
      try { process.kill(prior.pid, 0); alive = true; } catch { /* Stale marker after shutdown. */ }
    }
    if (alive) throw new Error('A local startup supervisor is already running.');
    fs.unlinkSync(marker);
  }
  fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, root }), { flag: 'wx' });
  owned = true;
  if (process.env.DEPLOYMENT_MODE !== 'local' || !['127.0.0.1', 'localhost', '::1'].includes(process.env.HOST || '127.0.0.1')) throw new Error('Automatic local startup requires local mode and a loopback host.');
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('Application port is occupied. Stop the existing server before starting the managed task.')));
    probe.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => probe.close(resolve));
  });
  const built = path.join(root, 'dist/server/index.js');
  if (!fs.existsSync(built)) throw new Error('Built server missing. Run npm run build before installing startup.');
  record(`\n${new Date().toISOString()} Starting local chatbot from ${root}\n`);
  await run(path.join(root, 'scripts/local/setup.mjs'));
  if (!stopping) await run(built);
} catch (error) {
  record(`${new Date().toISOString()} ${error.message}\n`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (owned) fs.unlinkSync(marker);
}
