import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const jestBin = require.resolve('jest/bin/jest');
const jestArgs = [jestBin, '--coverage', ...process.argv.slice(2)];

const testRun = spawnSync(process.execPath, jestArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
if (testRun.error) {
  console.error(`Unable to start Jest coverage: ${testRun.error.message}`);
  process.exit(1);
}
if (testRun.status !== 0) process.exit(testRun.status ?? 1);

const policyRun = spawnSync(process.execPath, ['scripts/release/check-server-coverage.mjs'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
if (policyRun.error) {
  console.error(`Unable to start server coverage policy check: ${policyRun.error.message}`);
  process.exit(1);
}
process.exit(policyRun.status ?? 1);
