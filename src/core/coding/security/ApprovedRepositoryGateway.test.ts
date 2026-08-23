import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRepoTools } from '../../tools/RepoTools';
import {
  ApprovedRepositoryGateway,
  RepositoryAccessError
} from './ApprovedRepositoryGateway';

function expectAccessError(action: () => unknown, code: RepositoryAccessError['code']): void {
  try {
    action();
    throw new Error(`Expected RepositoryAccessError with code ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RepositoryAccessError);
    expect((error as RepositoryAccessError).code).toBe(code);
  }
}

describe('ApprovedRepositoryGateway', () => {
  let root: string;
  let outside: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'approved-repository-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-repository-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'API Keys'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'hidden'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'safe.ts'), [
      'export function visible() {',
      "  return 'search-target';",
      '}'
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'API Keys', 'provider.txt'), 'private-token');
    fs.writeFileSync(path.join(root, '.env'), 'OPENAI_API_KEY=private-token');
    fs.writeFileSync(path.join(root, 'node_modules', 'hidden', 'ignored.ts'), 'search-target');
    fs.writeFileSync(path.join(outside, 'escape.ts'), 'export const escaped = true;');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('lists only bounded, non-sensitive files below the approved root', () => {
    const repository = new ApprovedRepositoryGateway(root);
    expect(repository.listFiles('.', 100)).toEqual(['src/safe.ts']);
    expect(repository.approvedRoot).toBe(fs.realpathSync.native(root));
  });

  it('rejects absolute paths, traversal, null bytes, and sensitive files', () => {
    const repository = new ApprovedRepositoryGateway(root);
    expectAccessError(() => repository.readTextFile(path.join(outside, 'escape.ts')), 'INVALID_PATH');
    expectAccessError(() => repository.readTextFile('../escape.ts'), 'OUTSIDE_ROOT');
    expectAccessError(() => repository.readTextFile('src/unsafe\0.ts'), 'INVALID_PATH');
    expectAccessError(() => repository.readTextFile('.env'), 'SENSITIVE_PATH');
    expectAccessError(() => repository.readTextFile('API Keys/provider.txt'), 'SENSITIVE_PATH');
  });

  it('rejects symlink and junction traversal even when the target exists', () => {
    const linked = path.join(root, 'linked');
    fs.symlinkSync(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
    const repository = new ApprovedRepositoryGateway(root);

    expect(repository.listFiles('.', 100)).toEqual(['src/safe.ts']);
    expectAccessError(() => repository.readTextFile('linked/escape.ts'), 'SYMLINK');
  });

  it('bounds text reads and refuses binary content', () => {
    const large = 'x'.repeat(2048);
    fs.writeFileSync(path.join(root, 'src', 'large.txt'), large);
    fs.writeFileSync(path.join(root, 'src', 'binary.dat'), Buffer.from([1, 0, 2]));
    const repository = new ApprovedRepositoryGateway(root, { maxReadBytes: 1024 });

    const result = repository.readTextFile('src/large.txt');
    expect(result.content).toHaveLength(1024);
    expect(result.size).toBe(2048);
    expect(result.truncated).toBe(true);
    expectAccessError(() => repository.readTextFile('src/binary.dat'), 'BINARY_FILE');
  });

  it('returns bounded literal-search evidence and scan metadata', () => {
    fs.writeFileSync(path.join(root, 'src', 'second.ts'), [
      'const first = "search-target";',
      'const second = "search-target";'
    ].join('\n'));
    const repository = new ApprovedRepositoryGateway(root);
    const result = repository.searchText('search-target', { maxResults: 2, maxFiles: 50 });

    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toEqual(expect.objectContaining({ path: 'src/safe.ts', line: 2 }));
    expect(result.scannedFiles).toBe(2);
    expect(result.truncated).toBe(true);
    expectAccessError(() => repository.searchText(''), 'LIMIT_EXCEEDED');
  });

  it('makes agent repository tools fail closed at the same boundary', async () => {
    const tools = createRepoTools(root);
    const read = tools.find(tool => tool.id === 'read_project_file');
    const search = tools.find(tool => tool.id === 'search_repo');

    const denied = await read?.execute({ path: '../escape.ts' });
    const allowed = await read?.execute({ path: 'src/safe.ts' });
    const matches = await search?.execute({ query: 'search-target', maxResults: 5 });

    expect(denied).toEqual(expect.objectContaining({ success: false }));
    expect(denied?.error).toContain('OUTSIDE_ROOT');
    expect(allowed).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ path: 'src/safe.ts', truncated: false })
    }));
    expect(matches).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ matches: [expect.objectContaining({ path: 'src/safe.ts' })] })
    }));
  });
});
