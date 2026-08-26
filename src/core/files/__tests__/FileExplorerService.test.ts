import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileExplorerService } from '../FileExplorerService';

describe('RT-PLAT-009 / RT-FILES-001: FileExplorerService Path Containment & Preview Suite', () => {
  let tempDir: string;
  let service: FileExplorerService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-explorer-test-'));
    service = new FileExplorerService(tempDir, 1024 * 10, 50);

    // Setup folder structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });

    // Setup files
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const greeting = "hello world";\nconsole.log(greeting);\n');
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\nWelcome to chatbot testing.\n');
    await fs.writeFile(path.join(tempDir, '.env'), 'DATABASE_PASSWORD=secret-1234\n');
    await fs.writeFile(path.join(tempDir, 'binary.dat'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('builds a tree of workspace files excluding ignored directories', async () => {
    const tree = await service.getTree('.', 3);
    expect(tree.type).toBe('directory');
    expect(tree.children?.some(c => c.name === 'src')).toBe(true);
    expect(tree.children?.some(c => c.name === 'README.md')).toBe(true);
    expect(tree.children?.some(c => c.name === '.git')).toBe(false);
    expect(tree.children?.some(c => c.name === '.env')).toBe(false);
  });

  it('throws when getting tree on a non-directory root', async () => {
    await expect(service.getTree('README.md')).rejects.toThrow('Tree root must be a directory');
  });

  it('searches files by name, content, and pagination', async () => {
    // Search by name
    const nameResults = await service.search('index', 'name');
    expect(nameResults.results.some(r => r.path === 'src/index.ts')).toBe(true);

    // Search by content
    const contentResults = await service.search('hello world', 'content');
    expect(contentResults.results.some(r => r.path === 'src/index.ts')).toBe(true);

    // Combined search with pagination
    const bothResults = await service.search('chatbot', 'both', { limit: 10 });
    expect(bothResults.results.some(r => r.path === 'README.md')).toBe(true);
  });

  it('reads file lines with safe slicing and checksums', async () => {
    const readResult = await service.readFile('src/index.ts', 1, 1);
    expect(readResult.content).toBe('export const greeting = "hello world";');
    expect(readResult.startLine).toBe(1);
    expect(readResult.endLine).toBe(1);
    expect(readResult.language).toBe('ts');
    expect(readResult.checksum).toBeDefined();

    const batch = await service.loadIntoChat([{ path: 'README.md' }, { path: 'src/index.ts' }]);
    expect(batch).toHaveLength(2);
    expect(batch[0].path).toBe('README.md');
  });

  it('rejects path traversal attempts outside workspace', async () => {
    await expect(service.readFile('../../etc/passwd')).rejects.toThrow('Path resolves outside workspace');
    await expect(service.getTree('../')).rejects.toThrow('Path resolves outside workspace');
  });

  it('protects secret files and unsupported non-previewable formats from reading', async () => {
    await expect(service.readFile('.env')).rejects.toThrow('Secret files are not previewable');
    await expect(service.readFile('binary.dat')).rejects.toThrow('File type is not previewable');
  });

  it('returns file metadata', async () => {
    const meta = await service.metadata('src/index.ts');
    expect(meta.type).toBe('file');
    expect(meta.extension).toBe('.ts');
    expect(meta.previewable).toBe(true);

    const dirMeta = await service.metadata('src');
    expect(dirMeta.type).toBe('directory');
  });
});
