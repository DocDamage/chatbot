import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatFinding, scanText } from './lib/secret-scan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const historyEnabled = process.argv.includes('--history');
const allowlistPath = path.join(root, 'config/secret-scan-allowlist.json');
const allowlist = new Set();

if (fs.existsSync(allowlistPath)) {
  const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  for (const value of parsed.fingerprints ?? []) allowlist.add(value);
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  });
}

const findings = [];
const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean);

for (const relativePath of files) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
  const buffer = fs.readFileSync(absolutePath);
  if (buffer.includes(0)) continue;
  findings.push(...scanText(buffer.toString('utf8'), relativePath, allowlist));
}

if (historyEnabled) {
  const log = git([
    'log',
    '--all',
    '--format=commit:%H',
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    '-p',
  ]);
  let commit = 'unknown';
  let currentPath = 'unknown';
  let line = 0;
  for (const entry of log.split(/\r?\n/)) {
    if (entry.startsWith('commit:')) commit = entry.slice('commit:'.length);
    if (entry.startsWith('+++ b/')) currentPath = entry.slice('+++ b/'.length);
    line += 1;
    if (!entry.startsWith('+') || entry.startsWith('+++')) continue;
    findings.push(
      ...scanText(entry.slice(1), `history:${commit.slice(0, 12)}:${currentPath}`, allowlist).map(
        (finding) => ({ ...finding, line }),
      ),
    );
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed with ${findings.length} potential secret(s). Values are redacted.`);
  for (const finding of findings) console.error(`- ${formatFinding(finding)}`);
  process.exit(1);
}

console.log(
  `Secret scan passed for ${files.length} current file(s)${historyEnabled ? ' and complete Git history' : ''}.`,
);
