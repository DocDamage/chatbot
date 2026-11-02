import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function optionalResolve(specifier) {
  try {
    return require.resolve(specifier);
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND') return undefined;
    throw error;
  }
}

const jestConfig = optionalResolve('jest-config/package.json');
const deepmerge = optionalResolve('deepmerge/package.json');

if (!jestConfig && !deepmerge) {
  console.log('Dependency patches skipped: Jest development dependencies are not installed.');
  process.exit(0);
}

if (!deepmerge) {
  throw new Error(`Dependency patch target is missing although Jest is installed: ${jestConfig}`);
}

const patchPackage = optionalResolve('patch-package/dist/index.js');
if (!patchPackage) {
  throw new Error(`patch-package is required because the deepmerge target is installed: ${deepmerge}`);
}

const result = spawnSync(process.execPath, [patchPackage, '--error-on-fail'], {
  cwd: repositoryRoot,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`patch-package failed with exit code ${result.status ?? 'unknown'}`);
}
