import fs from 'node:fs';
const workspace = fs.readFileSync(new URL('./pnpm-workspace.yaml', import.meta.url), 'utf8');
if (!workspace.includes('packages/*')) process.exit(1);
console.log('workspace contract passed');

