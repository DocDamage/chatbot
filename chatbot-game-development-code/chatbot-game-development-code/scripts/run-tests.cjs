const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function testsIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? testsIn(file) : entry.isFile() && file.endsWith('.test.js') ? [file] : [];
  });
}
const files = testsIn(path.join(__dirname, '..', 'dist', 'tests')).sort();
if (!files.length) throw new Error('No compiled tests found. Run npm run build first.');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exit(result.status === null ? 1 : result.status);
