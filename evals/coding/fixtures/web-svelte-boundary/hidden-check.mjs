import fs from 'node:fs';

const source = fs.readFileSync(new URL('./src/routes/+page.svelte', import.meta.url), 'utf8');
if (!source.includes('role="status"') || source.includes('window.')) process.exit(1);
