import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const checks = [
  {
    label: 'server entrypoint',
    path: path.join(root, 'dist', 'server', 'index.js'),
    validate: stats => stats.isFile(),
  },
  {
    label: 'client HTML shell',
    path: path.join(root, 'client', 'dist', 'index.html'),
    validate: stats => stats.isFile(),
  },
  {
    label: 'client assets directory',
    path: path.join(root, 'client', 'dist', 'assets'),
    validate: stats => stats.isDirectory(),
  },
];

const failures = [];

for (const check of checks) {
  try {
    const stats = fs.statSync(check.path);
    if (!check.validate(stats)) {
      failures.push(`${check.label} has the wrong filesystem type: ${check.path}`);
    }
  } catch {
    failures.push(`${check.label} is missing: ${check.path}`);
  }
}

const assetsDir = path.join(root, 'client', 'dist', 'assets');
if (fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length === 0) {
  failures.push(`client assets directory is empty: ${assetsDir}`);
}

if (failures.length > 0) {
  console.error('Packaging smoke failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Packaging smoke passed.');
