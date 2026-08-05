import fs from 'node:fs';
import path from 'node:path';
import { matchesGlobLike } from './lib/files.mjs';
import { buildRepositoryArtifacts, GENERATED_PATHS } from './generate-repository-inventory.mjs';

const root = process.cwd();
const boundaryPath = path.join(root, 'config/production-boundary.json');
const boundary = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
const artifacts = buildRepositoryArtifacts(root, boundary.entrypoints);
const reachability = JSON.parse(artifacts[GENERATED_PATHS.reachabilityJson]);
const failures = [];

function matchingRule(file, scope = 'any') {
  return boundary.rules.find(rule => {
    if (scope === 'reachable' && rule.scope === 'unreachable-only') return false;
    return rule.patterns.some(pattern => matchesGlobLike(file, pattern));
  });
}

for (const entrypoint of reachability.missingEntrypoints) failures.push(`missing entrypoint: ${entrypoint}`);

for (const file of reachability.reachableProduction) {
  const rule = matchingRule(file, 'reachable');
  if (!rule) continue;
  if (rule.registration === 'isolated') {
    failures.push(`${file} is reachable but classified as isolated by ${rule.id}`);
  }
  if (rule.availability === 'local-only' && !rule.runtimeGuard) {
    failures.push(`${file} is local-only without a named runtime guard`);
  }
}

const manifestPath = path.join(root, 'src/server/routeManifest.ts');
const manifest = fs.readFileSync(manifestPath, 'utf8');
for (const routeName of boundary.requiredLocalOnlyRouteNames) {
  const escaped = routeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wrappedLocalOnly = new RegExp(`localOnly\\(\\{\\s*name:\\s*['"]${escaped}['"]`);
  const explicitAvailability = new RegExp(`name:\\s*['"]${escaped}['"][\\s\\S]{0,220}?availability:\\s*['"]local-only['"]`);
  if (!wrappedLocalOnly.test(manifest) && !explicitAvailability.test(manifest)) {
    failures.push(`route ${routeName} is not explicitly marked local-only`);
  }
}
if (!/getActiveRouteManifest/.test(manifest) || !/resolveDeploymentMode/.test(manifest)) {
  failures.push('route manifest does not apply deployment-mode filtering');
}

const unreachableUnclassified = reachability.unreachable.filter(file => !matchingRule(file));
if (unreachableUnclassified.length > 0) {
  failures.push(`${unreachableUnclassified.length} unreachable production modules lack boundary classification`);
}

if (failures.length > 0) {
  console.error('Production-boundary check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production boundary passed: ${reachability.reachableProduction.length} reachable and ${reachability.unreachable.length} isolated/classified production modules.`);
