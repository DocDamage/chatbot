import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'docs/implementation/release-critical-documents.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const failures = [];
const today = new Date().toISOString().slice(0, 10);

function localLinks(markdown) {
  const links = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    if (!raw || /^(?:https?:|mailto:|#)/i.test(raw)) continue;
    links.push(raw.split('#')[0].split('?')[0]);
  }
  return links;
}

for (const document of registry.documents) {
  const absolute = path.join(root, document.path);
  if (!fs.existsSync(absolute)) {
    failures.push(`missing release-critical document: ${document.path}`);
    continue;
  }
  if (!document.owner) failures.push(`missing owner metadata: ${document.path}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.reviewDate)) failures.push(`invalid review date: ${document.path}`);
  if (document.reviewDate < today) failures.push(`stale review date: ${document.path} (${document.reviewDate})`);

  if (!document.path.endsWith('.md')) continue;
  const markdown = fs.readFileSync(absolute, 'utf8');
  for (const link of localLinks(markdown)) {
    const resolved = path.resolve(path.dirname(absolute), decodeURIComponent(link));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      failures.push(`link escapes repository: ${document.path} -> ${link}`);
    } else if (!fs.existsSync(resolved)) {
      failures.push(`broken local link: ${document.path} -> ${link}`);
    }
  }
}

for (const required of registry.requiredSetupMarkers) {
  const text = fs.readFileSync(path.join(root, required.path), 'utf8');
  for (const marker of required.markers) {
    if (!text.includes(marker)) failures.push(`${required.path} is missing required setup marker: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('Documentation validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation validation passed for ${registry.documents.length} release-critical documents.`);
