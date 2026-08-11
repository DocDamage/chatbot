import fs from 'fs';
import os from 'os';
import path from 'path';
import { StructuredEditEngine } from './editing/StructuredEditEngine';

describe('StructuredEditEngine', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-edit-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('creates and applies authorized multi-file patches with preconditions', () => {
    fs.writeFileSync(path.join(root, 'a.ts'), 'old\n');
    const engine = new StructuredEditEngine(root);
    const patch = engine.createPatch([
      { operation: 'modify', path: 'a.ts', expectedContent: 'old\n', content: 'new\n', reason: 'Fix behavior', authorized: true },
      { operation: 'create', path: 'b.ts', content: 'export const ok = true;\n', reason: 'Add companion module', authorized: true }
    ]);
    expect(patch.conflicts).toEqual([]);
    expect(patch.filesChanged).toEqual(['a.ts', 'b.ts']);
    engine.apply(patch);
    expect(fs.readFileSync(path.join(root, 'a.ts'), 'utf8')).toBe('new\n');
    expect(fs.existsSync(path.join(root, 'b.ts'))).toBe(true);
  });

  it('rejects changed files before apply', () => {
    fs.writeFileSync(path.join(root, 'a.ts'), 'old\n');
    const patch = new StructuredEditEngine(root).createPatch([{ operation: 'modify', path: 'a.ts', expectedContent: 'stale\n', content: 'new\n', reason: 'Fix', authorized: true }]);
    expect(patch.conflicts[0].reason).toContain('precondition');
  });

  it('keeps natural-language drafts unauthorized and conflict-free until application', () => {
    fs.writeFileSync(path.join(root, 'a.ts'), 'const answer = "old";\n');
    const patch = new StructuredEditEngine(root).fromNaturalLanguage('replace "old" with "new" in a.ts; create file b.ts with "export const ok = true;"');
    expect(patch.operations).toHaveLength(2);
    expect(patch.conflicts).toEqual([]);
    expect(patch.operations.every(operation => operation.authorized)).toBe(false);
    expect(patch.diff).toContain('a.ts');
  });

  it('rejects unauthorized operations when constructing an application patch', () => {
    const patch = new StructuredEditEngine(root).createPatch([{ operation: 'create', path: 'a.ts', content: 'new\n', reason: 'Fix', authorized: false }]);
    expect(patch.conflicts.map(conflict => conflict.reason)).toContain('Operation requires explicit authorization');
  });
});
