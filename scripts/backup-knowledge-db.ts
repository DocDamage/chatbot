// Compatibility entry point for the shared scheduled/interactive backup implementation.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, [path.join(__dirname, 'local/backup.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true, shell: false,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
