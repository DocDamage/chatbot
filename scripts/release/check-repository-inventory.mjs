import fs from 'node:fs';
import path from 'node:path';
import { buildRepositoryArtifacts } from './generate-repository-inventory.mjs';

const root = process.cwd();
const expected = buildRepositoryArtifacts(root);
const failures = [];

for (const [relativePath, generated] of Object.entries(expected)) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing`);
    continue;
  }
  const committed = fs.readFileSync(absolutePath, 'utf8');
  if (committed !== generated) failures.push(`${relativePath} is stale`);
}

if (failures.length > 0) {
  console.error('Repository inventory check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('Run: node scripts/release/generate-repository-inventory.mjs');
  process.exit(1);
}

console.log(`Repository inventory is current (${Object.keys(expected).length} artifacts).`);
