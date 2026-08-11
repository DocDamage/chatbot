import fs from 'node:fs';
const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
if (!html.includes('<main>') || !html.includes('for="email"') || !css.includes('@media')) process.exit(1);
console.log('HTML/CSS semantic and responsive checks passed.');

