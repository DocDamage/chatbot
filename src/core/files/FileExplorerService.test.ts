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

    const results = await service.search('answer', 'content');
    expect(results.some(result => result.path === 'src/app.ts')).toBe(true);

    const file = await service.readFile('src/app.ts', 1, 1);
    expect(file.content).toBe('const answer = 42;');
    expect(file.startLine).toBe(1);
    expect(file.endLine).toBe(1);

    await expect(service.readFile('../package.json')).rejects.toThrow(/outside workspace/i);
    await expect(service.readFile('.env')).rejects.toThrow(/secret/i);
  });
});
