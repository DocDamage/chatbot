import { SymbolIndex } from './SymbolIndex';
import { ParserProvider } from './ParserProvider';

describe('SymbolIndex architecture reporting', () => {
  it('reports parser identity and keeps identical source attached to each path', () => {
    const parser: ParserProvider = {
      id: 'fixture-parser-1',
      supports: () => true,
      parse: (file, content) => [{
        kind: 'function', name: content.trim(), file, line: 1,
        confidence: 1, parser: 'fixture-parser-1'
      }]
    };
    const index = new SymbolIndex(process.cwd(), [parser]);
    const first = index.indexContentWithReport('a.ts', 'duplicate');
    const second = index.indexContentWithReport('b.ts', 'duplicate');

    expect(index.parserVersion).toContain('fixture-parser-1');
    expect(first.parser).toBe('fixture-parser-1');
    expect(first.symbols[0].file).toBe('a.ts');
    expect(second.symbols[0].file).toBe('b.ts');
  });

  it('falls through a failed parser without executing repository code', () => {
    const failed: ParserProvider = {
      id: 'failed-parser',
      supports: () => true,
      parse: () => { throw new Error('parser failed'); }
    };
    const fallback: ParserProvider = {
      id: 'safe-fallback',
      supports: () => true,
      parse: file => [{
        kind: 'module', name: 'safe', file, line: 1,
        confidence: 0.5, parser: 'safe-fallback'
      }]
    };
    const result = new SymbolIndex(process.cwd(), [failed, fallback])
      .indexContentWithReport('safe.ts', 'not executable');

    expect(result.parser).toBe('safe-fallback');
    expect(result.symbols[0]).toEqual(expect.objectContaining({ file: 'safe.ts', name: 'safe' }));
  });
});
