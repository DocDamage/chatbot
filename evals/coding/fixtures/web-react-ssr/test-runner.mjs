import fs from 'node:fs';
const source = fs.readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8');
if (!source.includes('role="status"') || source.includes('window.')) process.exit(1);
console.log('React SSR/accessibility fixture checks passed.');

