import path from 'path';
import { SymbolIndex } from './SymbolIndex';

describe('compiler-backed repository references', () => {
  it('follows imported aliases and excludes comments, strings, shadowed parameters and similar names', () => {
    const index = new SymbolIndex(process.cwd());
    index.indexContentWithReport('calc.ts', 'export function calculate(value: number) { return value + 1; }\n');
    index.indexContentWithReport('use.ts', "import { calculate as plusOne } from './calc';\nexport function run() { return plusOne(2); }\nconst calculateExtra = 'calculate'; // calculate\nfunction local(calculate: number) { return calculate; }\n");
    const refs = index.findReferences('calculate');
    expect(refs.some(ref => ref.file === 'use.ts' && ref.line === 2)).toBe(true);
    expect(refs.some(ref => ref.file === 'use.ts' && ref.line >= 3)).toBe(false);
    expect(refs.every(ref => ref.parser === 'typescript-language-service:reference')).toBe(true);
  });
  it('requires a location to disambiguate unrelated declarations and never uses substring matching', () => {
    const index = new SymbolIndex(process.cwd());
    index.indexContentWithReport('first.ts', 'export function same() {}\nsame();\n');
    index.indexContentWithReport('second.ts', 'export function same() {}\nsame();\n');
    expect(index.findReferences('sam')).toEqual([]);
    expect(index.findReferences('same')).toEqual([]);
    const refs = index.findReferences('same', { file: 'first.ts', line: 1, column: 17 });
    expect(refs.some(ref => ref.file === 'first.ts' && ref.line === 2)).toBe(true);
    expect(refs.some(ref => ref.file === 'second.ts')).toBe(false);
  });
});
