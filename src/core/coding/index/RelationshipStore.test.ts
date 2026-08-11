import fs from 'fs';
import os from 'os';
import path from 'path';
import { RelationshipStore } from './RelationshipStore';
import { SymbolIndex } from './SymbolIndex';

describe('RelationshipStore', () => {
  it('builds cross-file import and test relationships', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-relationships-'));
    try {
      fs.writeFileSync(path.join(root, 'a.ts'), 'import { value } from "./b";\nexport function a() { return value; }');
      fs.writeFileSync(path.join(root, 'a.test.ts'), 'test("a works", () => a());');
      fs.writeFileSync(path.join(root, 'b.ts'), 'export const value = 1;');
      const index = new SymbolIndex(root); index.indexFiles(['a.ts', 'a.test.ts', 'b.ts']);
      const store = new RelationshipStore(root); store.build(['a.ts', 'a.test.ts', 'b.ts'], index.all());
      expect(store.query('imports', 'a.ts')).toEqual(expect.arrayContaining([expect.objectContaining({ to: './b' })]));
      expect(store.query('tests', 'a.test.ts')).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'tests' })]));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('resolves local imports and records references, callers, and implementations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-relationships-polyglot-'));
    try {
      fs.writeFileSync(path.join(root, 'base.py'), 'class Base:\n    pass\n');
      fs.writeFileSync(path.join(root, 'worker.py'), 'from .base import Base\nclass Worker(Base):\n    def run(self):\n        return Base()\n');
      const files = ['base.py', 'worker.py'];
      const index = new SymbolIndex(root); index.indexFiles(files);
      const store = new RelationshipStore(root); store.build(files, index.all());
      expect(store.query('depends_on', 'worker.py')).toEqual(expect.arrayContaining([expect.objectContaining({ to: 'base.py' })]));
      expect(store.query('implements', 'worker.py')).toEqual(expect.arrayContaining([expect.objectContaining({ to: 'base.py' })]));
      expect(store.query('callers', 'worker.py')).toEqual(expect.arrayContaining([expect.objectContaining({ from: 'worker.py' })]));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
