import fs from 'fs';
import path from 'path';

const output = path.join(process.cwd(), 'knowledge-base-public', 'chrono', 'wikidata-spine.json');
const records = [
  { id: 'wikidata-wheel', type: 'invention', name: 'Wheel', domains: ['science', 'invention'], source: 'Wikidata curated spine', confidence: 0.7 },
  { id: 'wikidata-bronze-age', type: 'event', name: 'Bronze Age', domains: ['history', 'science'], source: 'Wikidata curated spine', confidence: 0.7 }
];
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Wrote ${records.length} curated Wikidata chrono spine records.`);
