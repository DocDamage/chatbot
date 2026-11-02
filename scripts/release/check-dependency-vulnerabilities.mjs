import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const workspaces = [
  { name: 'server', cwd: root, omitDev: true },
  { name: 'client', cwd: path.join(root, 'client'), omitDev: true },
  // Electron is intentionally declared as a development dependency even though it
  // is the desktop companion's runtime, so its complete tree must be audited.
  { name: 'desktop-companion', cwd: path.join(root, 'desktop-companion'), omitDev: false },
  { name: 'coding-tools', cwd: path.join(root, 'services', 'coding-tools'), omitDev: true },
  { name: 'rea', cwd: path.join(root, 'services', 'rea'), omitDev: true },
];
const blockedSeverities = new Set(['critical', 'high']);
let failed = false;

function npmAudit(cwd, omitDev) {
  const auditArgs = ['audit', ...(omitDev ? ['--omit=dev'] : []), '--json'];
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

function optionalResolve(specifier) {
  try {
    return require.resolve(specifier);
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND') return undefined;
    throw error;
  }
}

function verifyDevelopmentDependencyPatches() {
  const jestConfig = optionalResolve('jest-config/package.json');
  const deepmerge = optionalResolve('deepmerge/package.json');

  if (!jestConfig && !deepmerge) {
    console.log('server-dev-patches: skipped (Jest/deepmerge development dependencies are absent)');
    return;
  }
  if (!deepmerge) {
    throw new Error(`server-dev-patches: deepmerge is missing although Jest is installed: ${jestConfig}`);
  }

  execFileSync(
    process.execPath,
    ['--test', path.join(root, 'scripts', 'dependencies', '__tests__', 'deepmerge-patch.test.mjs')],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  console.log('server-dev-patches: deepmerge exploit and compatibility checks passed');
}

for (const workspace of workspaces) {
  let report;
  try {
    const output = npmAudit(workspace.cwd, workspace.omitDev);
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

try {
  verifyDevelopmentDependencyPatches();
} catch (error) {
  console.error(error.stderr?.toString() || error.message || String(error));
  failed = true;
}

if (failed) {
  console.error('Dependency vulnerability gate failed: a runtime audit or development patch check did not pass.');
  process.exit(1);
}

console.log('Dependency vulnerability gate passed for all shipped Node runtime trees.');
