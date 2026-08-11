import { TreeSitterParserProvider } from './TreeSitterParserProvider';

describe('TreeSitterParserProvider', () => {
  const provider = new TreeSitterParserProvider();

  it.each([
    ['systems.c', 'struct Buffer { int size; }; int release(Buffer *buffer) { return buffer->size; }', ['Buffer', 'release']],
    ['service.go', 'package service\ntype Server struct{}\nfunc Start() {}', ['Server', 'Start']],
    ['service.py', 'class Cart:\n    pass\ndef total(items):\n    return sum(items)', ['Cart', 'total']],
    ['service.rs', 'struct Cart { total: i32 }\nfn calculate() -> i32 { 0 }', ['Cart', 'calculate']],
    ['service.java', 'class Cart { void add() {} }', ['Cart', 'add']]
  ])('indexes named syntax nodes for %s', (file, content, expectedNames) => {
    const symbols = provider.parse(file, content);
    expect(symbols.map(symbol => symbol.name)).toEqual(expect.arrayContaining(expectedNames));
    expect(symbols.every(symbol => symbol.parser.startsWith('tree-sitter:'))).toBe(true);
    expect(symbols.every(symbol => symbol.confidence >= 0.8)).toBe(true);
  });

  it('does not claim unsupported formats are grammar-backed', () => {
    expect(provider.supports('view.svelte')).toBe(false);
    expect(provider.parse('view.svelte', '<script>export let value;</script>')).toEqual([]);
  });

  it('reports syntax errors with reduced confidence while retaining symbols', () => {
    const symbols = provider.parse('broken.rs', 'fn missing() { let value = ; }');
    expect(symbols.some(symbol => symbol.name === 'missing')).toBe(true);
    expect(symbols.every(symbol => symbol.confidence < 0.95)).toBe(true);
  });
});
