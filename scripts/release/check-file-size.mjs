import fs from 'node:fs';
import path from 'node:path';
import { isProductionSource } from './lib/source-analysis.mjs';
import { lineCount, readText, walkFiles, writeText } from './lib/files.mjs';

const root = process.cwd();
const registerPath = 'docs/architecture/large-file-register.md';
const writeRegister = process.argv.includes('--write-register');
const generatedAndMigrations = [
  /^src\/data\/migrations\//,
  /^src\/.*\/migrations\//,
  /\.generated\.[jt]sx?$/,
  /\/generated\//
];

function exempt(file) {
  return generatedAndMigrations.some(pattern => pattern.test(file));
}

function recommendation(file) {
  if (file === 'src/server/index.ts') return 'Split startup, middleware, and route composition into focused modules.';
  if (/route/i.test(file)) return 'Separate route declarations, validation, and handler/service composition.';
  if (/orchestrat|initializ/i.test(file)) return 'Separate dependency construction, lifecycle, and orchestration policies.';
  if (file.startsWith('client/src/')) return 'Extract state hooks, API adapters, and cohesive subcomponents.';
  if (/provider/i.test(file)) return 'Separate provider contracts, transport, capability mapping, and error translation.';
  return 'Review cohesive responsibilities and extract independently testable modules without fragmentation.';
}

const files = walkFiles(root, {
  include: (_absolute, relative) => isProductionSource(relative)
});
const oversized = files
  .map(file => ({ file, lines: lineCount(readText(root, file)) }))
  .filter(item => item.lines > 300 && !exempt(item.file))
  .sort((a, b) => a.file.localeCompare(b.file));

function renderRegister() {
  const rows = oversized.map(item =>
    `| \`${item.file}\` | ${item.lines} | Pre-existing cohesive module; retained to avoid unsafe task-wide refactor. | ${recommendation(item.file)} | Phase-specific owner | Review during the feature's Phase 7 task or an earlier risk-driven refactor. |`
  );
  return `# Large File Register\n\n` +
    `This deterministic register covers production source files above 300 lines. New unregistered files fail CI. ` +
    `The register is not permission to grow a file without review.\n\n` +
    `| File | Lines | Current justification | Reviewed decomposition options | Owner | Follow-up |\n` +
    `|---|---:|---|---|---|---|\n${rows.join('\n')}\n`;
}

if (writeRegister) {
  writeText(root, registerPath, renderRegister());
  console.log(`Wrote ${registerPath} with ${oversized.length} entries.`);
  process.exit(0);
}

if (!fs.existsSync(path.join(root, registerPath))) {
  console.error(`${registerPath} is missing. Run this script with --write-register.`);
  process.exit(1);
}

const committed = fs.readFileSync(path.join(root, registerPath), 'utf8');
const expected = renderRegister();
if (committed !== expected) {
  console.error(`${registerPath} is stale. Run: node scripts/release/check-file-size.mjs --write-register`);
  process.exit(1);
}

console.log(`File-size policy passed; ${oversized.length} registered production files exceed 300 lines.`);
