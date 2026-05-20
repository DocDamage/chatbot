import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeGraphIndexer } from './KnowledgeGraphIndexer';

describe('KnowledgeGraphIndexer', () => {
  it('skips oversized files and respects maxFiles', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-graph-'));
    fs.writeFileSync(path.join(tempDir, 'small.ts'), 'export function usefulThing() { return "ok"; }');
    fs.writeFileSync(path.join(tempDir, 'large.md'), 'x'.repeat(600 * 1024));

    const indexer = new KnowledgeGraphIndexer({ workspaceRoot: tempDir, maxFiles: 10 });
    const graph = await indexer.build({ includeRepo: true, includeRag: false, maxFiles: 10 });

    expect(graph.nodes.some(node => node.label === 'small.ts')).toBe(true);
    expect(graph.nodes.some(node => node.label === 'large.md')).toBe(false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
