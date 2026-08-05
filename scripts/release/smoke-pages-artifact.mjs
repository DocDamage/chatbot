import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const distDirectory = resolve(process.cwd(), process.argv[2] || 'dist');
const indexPath = resolve(distDirectory, 'index.html');
const marker = 'Static interface demo only';
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /\bgh[oprsu]_[A-Za-z0-9]{20,}/
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }
  return files;
}

const html = await readFile(indexPath, 'utf8');
const assetReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(reference => reference.startsWith('/chatbot/'));

assert(assetReferences.length > 0, 'The Pages index does not reference repository-scoped assets.');

for (const reference of assetReferences) {
  const assetPath = resolve(distDirectory, reference.slice('/chatbot/'.length));
  const assetStat = await stat(assetPath);
  assert(assetStat.isFile() && assetStat.size > 0, `Missing or empty asset: ${reference}`);
}

const files = await listFiles(distDirectory);
const sourceMaps = files.filter(file => file.endsWith('.map'));
assert(sourceMaps.length === 0, `Unexpected source maps: ${sourceMaps.map(file => relative(distDirectory, file)).join(', ')}`);

const textFiles = files.filter(file => /\.(?:html|js|css|json|txt)$/i.test(file));
const builtText = (await Promise.all(textFiles.map(file => readFile(file, 'utf8')))).join('\n');
assert(builtText.includes(marker), 'The built artifact does not contain the static-demo limitation marker.');
assert(!builtText.includes('VITE_PUBLIC_API_BASE_URL'), 'The built artifact contains an unresolved API configuration token.');

for (const pattern of secretPatterns) {
  assert(!pattern.test(builtText), `The built artifact matched forbidden secret pattern ${pattern}.`);
}

console.log(JSON.stringify({
  status: 'passed',
  distDirectory,
  files: files.length,
  repositoryScopedAssets: assetReferences.length,
  marker
}, null, 2));
