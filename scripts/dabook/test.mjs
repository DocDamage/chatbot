import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dabookRoot, venvPython } from './dabook-env.mjs';

if (!existsSync(venvPython)) {
  console.error('DABOOK venv not found. Run `npm run setup:dabook` first.');
  process.exit(1);
}

const result = spawnSync(venvPython, ['-m', 'pytest', ...process.argv.slice(2)], {
  cwd: dabookRoot,
  stdio: 'inherit',
  windowsHide: true
});
process.exit(result.status ?? 1);
