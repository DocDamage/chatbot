import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = path.join(root, 'release-artifacts');
fs.mkdirSync(outputDirectory, { recursive: true });

const packArgs = ['pack', '--json', '--pack-destination', outputDirectory];
const output = process.env.npm_execpath
  ? execFileSync(process.execPath, [process.env.npm_execpath, ...packArgs], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  : execFileSync('npm', packArgs, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    });
const [result] = JSON.parse(output);
if (!result?.filename || !Array.isArray(result.files)) {
  throw new Error('npm pack did not return an inspectable artifact manifest.');
}

const paths = new Set(result.files.map((file) => file.path.replaceAll('\\', '/')));
for (const required of ['dist/server/index.js', 'client/dist/index.html', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  if (!paths.has(required)) throw new Error(`Release artifact is missing required file: ${required}`);
}

const forbidden = result.files
  .map((file) => file.path.replaceAll('\\', '/'))
  .filter((file) => /(^|\/)(?:\.env(?:\.|$)|API Keys|node_modules|coverage|logs?)(?:\/|$)/i.test(file));
if (forbidden.length > 0) {
  throw new Error(`Release artifact contains forbidden path(s): ${forbidden.join(', ')}`);
}

const artifactPath = path.join(outputDirectory, result.filename);
const digest = createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
const checksum = `${digest}  ${result.filename}\n`;
fs.writeFileSync(path.join(outputDirectory, 'checksums.sha256'), checksum, 'utf8');
fs.writeFileSync(
  path.join(outputDirectory, 'artifact-inventory.json'),
  `${JSON.stringify({
    artifact: result.filename,
    bytes: result.size,
    sha256: digest,
    files: result.files.map((file) => ({ path: file.path, bytes: file.size })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Release artifact created: ${path.relative(root, artifactPath)} (${result.size} bytes)`);
console.log(`SHA-256: ${digest}`);
