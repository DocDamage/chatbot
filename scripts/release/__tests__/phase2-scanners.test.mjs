import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeSourceFile, scanRepository } from '../lib/source-analysis.mjs';
import { buildReachability } from '../lib/reachability.mjs';

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-scan-'));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test('source analysis inventories routes, env, classes, tables, and binaries', () => {
  const result = analyzeSourceFile('src/server/example.ts', `
    import { thing } from './thing';
    const port = process.env.PORT;
    router.post('/api/items', handler);
    export class ItemService {}
    db.exec('CREATE TABLE IF NOT EXISTS items (id TEXT)');
    execFile('ffmpeg', ['-version']);
  `);
  assert.deepEqual(result.imports, ['./thing']);
  assert.deepEqual(result.envVariables, ['PORT']);
  assert.equal(result.routes[0].path, '/api/items');
  assert.deepEqual(result.classesByKind.services, ['ItemService']);
  assert.deepEqual(result.tables, ['items']);
  assert.deepEqual(result.externalBinaries, ['ffmpeg']);
});

test('reachability follows literal relative imports and leaves dormant code isolated', () => {
  const root = fixture({
    'src/server/index.ts': `import './live';`,
    'src/server/live.ts': `export const live = true;`,
    'src/server/dormant.ts': `export const dormant = true;`,
    'client/src/main.tsx': `import './App';`,
    'client/src/App.tsx': `export const App = () => null;`
  });
  const scan = scanRepository(root);
  const reachability = buildReachability(scan);
  assert.ok(reachability.reachableProduction.includes('src/server/live.ts'));
  assert.ok(reachability.unreachable.includes('src/server/dormant.ts'));
  assert.equal(reachability.missingEntrypoints.length, 0);
});
