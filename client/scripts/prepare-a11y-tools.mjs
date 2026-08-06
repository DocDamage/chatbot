import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
const toolRoot = join(clientRoot, '.a11y-tools');
const toolModules = join(toolRoot, 'node_modules');
const localModules = join(clientRoot, 'node_modules');

await rm(toolRoot, { recursive: true, force: true });
await mkdir(toolRoot, { recursive: true });
await writeFile(join(toolRoot, 'package.json'), JSON.stringify({
  private: true,
  dependencies: {
    '@axe-core/playwright': '4.12.1',
    '@playwright/test': '1.62.0',
  },
}, null, 2));

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npmCommand, [
  'install',
  '--prefix', toolRoot,
  '--package-lock=false',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
], {
  cwd: clientRoot,
  stdio: 'inherit',
});

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

async function linkPackage(packageName) {
  const segments = packageName.split('/');
  const source = join(toolModules, ...segments);
  const destination = join(localModules, ...segments);

  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await symlink(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
}

await linkPackage('@playwright/test');
await linkPackage('@axe-core/playwright');

console.log('Prepared isolated accessibility tools: @playwright/test 1.62.0 and @axe-core/playwright 4.12.1.');
