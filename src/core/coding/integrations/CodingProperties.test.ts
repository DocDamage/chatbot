import fs from 'fs';
import os from 'os';
import path from 'path';
import * as fc from 'fast-check';
import { StructuredEditEngine } from '../editing/StructuredEditEngine';
import { resolveContextImport } from './AutomaticContext';
import { introducedDiagnostics, DraftDiagnostic } from './DraftDiagnostics';

const seed = 20261031;
describe('coding invariants with fast-check', () => {
  it('preserves arbitrary Unicode text and rejects stale reviewed modifications', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-properties-'));
    const scalar = fc.oneof(fc.integer({ min: 32, max: 0xd7ff }), fc.integer({ min: 0xe000, max: 0x10ffff }));
    const text = fc.array(scalar, { maxLength: 80 }).map(points => String.fromCodePoint(...points));
    try {
      fc.assert(fc.property(text, text, (before, after) => {
        const absolute = path.join(root, 'value.txt'); fs.writeFileSync(absolute, before);
        const engine = new StructuredEditEngine(root);
        const operation = { operation: 'modify' as const, path: 'value.txt', expectedContent: before, content: after, reason: 'Property fixture', authorized: true };
        const patch = engine.createPatch([operation]); engine.apply(patch);
        expect(fs.readFileSync(absolute, 'utf8')).toBe(after);
        const next = engine.createPatch([{ ...operation, expectedContent: after }]);
        fs.writeFileSync(absolute, `${after}\nconcurrent edit`);
        expect(() => engine.apply(next)).toThrow(/preconditions changed/);
        expect(fs.readFileSync(absolute, 'utf8')).toBe(`${after}\nconcurrent edit`);
      }), { seed, numRuns: 100 });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it('resolves local imports only to known in-repository source paths', () => {
    const name = fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 20 }).map(parts => parts.join(''));
    fc.assert(fc.property(name, name, (folder, module) => {
      const known = new Set([`${folder}/${module}.ts`]);
      expect(resolveContextImport(`${folder}/caller.ts`, `./${module}`, known)).toBe(`${folder}/${module}.ts`);
      expect(resolveContextImport(`${folder}/caller.ts`, `./${module}.js`, known)).toBe(`${folder}/${module}.ts`);
      expect(resolveContextImport('caller.ts', `../${folder}/${module}`, known)).toBeUndefined();
      expect(resolveContextImport('caller.ts', 'fs', known)).toBeUndefined();
    }), { seed, numRuns: 200 });
  });
  it('counts new diagnostics independently of line shifts and duplicate messages', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 1, max: 1000 }), (oldCount, nextCount, line) => {
      const item: DraftDiagnostic = { tool: 'eslint', file: 'value.js', code: 'no-undef', message: 'missing is not defined' };
      expect(introducedDiagnostics(Array.from({ length: oldCount }, () => ({ ...item, line: 1 })),
        Array.from({ length: nextCount }, () => ({ ...item, line })))).toHaveLength(Math.max(0, nextCount - oldCount));
    }), { seed, numRuns: 200 });
  });
});
