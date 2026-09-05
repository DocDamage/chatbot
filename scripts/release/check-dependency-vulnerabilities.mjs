import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspaces = [
  { name: 'server', cwd: root },
  { name: 'client', cwd: path.join(root, 'client') },
];
const blockedSeverities = new Set(['critical', 'high']);
let failed = false;

function npmAudit(cwd) {
  const auditArgs = ['audit', '--omit=dev', '--json'];
  if (process.env.npm_execpath) {
    return execFileSync(process.execPath, [process.env.npm_execpath, ...auditArgs], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return execFileSync('npm', auditArgs, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

for (const workspace of workspaces) {
  let report;
  try {
    const output = npmAudit(workspace.cwd);
    report = JSON.parse(output);
  } catch (error) {
    const output = error.stdout?.toString() ?? '';
    try {
      report = JSON.parse(output);
    } catch {
      console.error(`${workspace.name}: npm audit could not produce a valid report.`);
      failed = true;
      continue;
    }
  }

  const counts = report.metadata?.vulnerabilities ?? {};
  const summary = ['critical', 'high', 'moderate', 'low']
    .map((severity) => `${severity}=${counts[severity] ?? 0}`)
    .join(', ');
  console.log(`${workspace.name}: ${summary}`);

  for (const severity of blockedSeverities) {
    if ((counts[severity] ?? 0) > 0) failed = true;
  }
}

if (failed) {
  console.error('Dependency vulnerability gate failed: critical/high production findings remain.');
  process.exit(1);
}

console.log('Dependency vulnerability gate passed for server and client production trees.');
