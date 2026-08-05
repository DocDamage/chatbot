import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildInventory, renderInventoryMarkdown, renderReachabilityMarkdown } from './lib/render.mjs';
import { buildReachability, DEFAULT_ENTRYPOINTS } from './lib/reachability.mjs';
import { scanRepository } from './lib/source-analysis.mjs';
import { stableJson, writeText } from './lib/files.mjs';

export const GENERATED_PATHS = {
  inventoryJson: 'docs/architecture/generated/repository-inventory.json',
  inventoryMarkdown: 'docs/architecture/generated/repository-inventory.md',
  reachabilityJson: 'docs/architecture/generated/reachability-map.json',
  reachabilityMarkdown: 'docs/architecture/generated/reachability-map.md'
};

export function buildRepositoryArtifacts(root = process.cwd(), entrypoints = DEFAULT_ENTRYPOINTS) {
  const scan = scanRepository(root);
  const reachability = buildReachability(scan, entrypoints);
  const inventory = buildInventory(scan, reachability);
  return {
    [GENERATED_PATHS.inventoryJson]: stableJson(inventory),
    [GENERATED_PATHS.inventoryMarkdown]: renderInventoryMarkdown(inventory),
    [GENERATED_PATHS.reachabilityJson]: stableJson(reachability),
    [GENERATED_PATHS.reachabilityMarkdown]: renderReachabilityMarkdown(reachability)
  };
}

export function writeRepositoryArtifacts(root = process.cwd()) {
  const artifacts = buildRepositoryArtifacts(root);
  for (const [relativePath, content] of Object.entries(artifacts)) {
    writeText(root, relativePath, content);
  }
  return Object.keys(artifacts);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const root = process.cwd();
  const written = writeRepositoryArtifacts(root);
  console.log(`Generated ${written.length} repository inventory artifacts.`);
}
