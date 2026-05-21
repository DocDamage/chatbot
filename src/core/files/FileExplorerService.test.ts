import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileExplorerService } from './FileExplorerService';

describe('FileExplorerService', () => {
  it('lists, searches, reads, and blocks unsafe paths', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-explorer-'));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'app.ts'), 'const answer = 42;\nexport default answer;\n');
    fs.writeFileSync(path.join(root, '.env'), 'TOKEN=secret\n');

    const service = new FileExplorerService(root);
    const tree = await service.getTree('.', 3);
    expect(tree.children?.some(child => child.name === 'src')).toBe(true);

    const search = await service.search('answer', 'content');
    expect(search.results.some(result => result.path === 'src/app.ts')).toBe(true);

    const file = await service.readFile('src/app.ts', 1, 1);
    expect(file.content).toBe('const answer = 42;');
    expect(file.startLine).toBe(1);
    expect(file.endLine).toBe(1);

    await expect(service.readFile('../package.json')).rejects.toThrow(/outside workspace/i);
    await expect(service.readFile('.env')).rejects.toThrow(/secret/i);
  });

  it('paginates search results and skips oversized content reads', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-search-'));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'needle one\n');
    fs.writeFileSync(path.join(root, 'src', 'b.ts'), 'needle two\n');
    fs.writeFileSync(path.join(root, 'src', 'large.ts'), `${'x'.repeat(2048)}needle\n`);

    const service = new FileExplorerService(root);
    const firstPage = await service.search('needle', 'content', { limit: 1, maxContentBytes: 1024 });

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.nextOffset).toBe(1);

    const secondPage = await service.search('needle', 'content', { limit: 1, offset: firstPage.nextOffset, maxContentBytes: 1024 });
    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.results[0].path).not.toBe(firstPage.results[0].path);

    const fullScan = await service.search('needle', 'content', { limit: 10, maxContentBytes: 1024 });
    expect(fullScan.skippedLargeFiles).toBe(1);
  });
});
