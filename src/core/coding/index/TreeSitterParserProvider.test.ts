import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { TreeSitterParserProvider } from './TreeSitterParserProvider';

const peerOverrideCases: ReadonlyArray<readonly [string, string, string, readonly string[]]> = [
  ['c', 'systems.c', 'struct Buffer { int size; }; int release(struct Buffer *buffer) { return buffer->size; }', ['Buffer', 'release']],
  ['cpp', 'templates.cpp', 'template <typename T> class Box { public: T value; }; int release(Box<int>* box) { return box->value; }', ['Box', 'release']],
  ['java', 'Cart.java', 'class Cart { int add(int value) { return value + 1; } }', ['Cart', 'add']],
  ['kotlin', 'Cart.kt', 'class Cart {\n fun add(value: Int): Int { return value + 1 }\n}', ['Cart']],
  ['rust', 'cart.rs', 'struct Cart { total: i32 } fn calculate() -> i32 { 0 }', ['Cart', 'calculate']],
  ['swift', 'Cart.swift', 'struct Cart { func total() -> Int { return 1 } }', ['Cart', 'total']],
];

describe('TreeSitterParserProvider', () => {
  const provider = new TreeSitterParserProvider();
  let nativeProbe: Record<string, ReturnType<TreeSitterParserProvider['parse']>>;

  beforeAll(() => {
    // N-API grammar objects can be retained by another Jest VM during the full coverage run.
    // Probe the production provider in a clean Node process while keeping ordinary provider
    // behavior covered in this VM below.
    const providerPath = path.resolve(__dirname, 'TreeSitterParserProvider.ts');
    const script = [
      `const { TreeSitterParserProvider } = require(${JSON.stringify(providerPath)});`,
      `const cases = ${JSON.stringify(peerOverrideCases)};`,
      'const provider = new TreeSitterParserProvider();',
      'const results = Object.fromEntries(cases.map(([grammar, file, content]) => [grammar, provider.parse(file, content)]));',
      'process.stdout.write(JSON.stringify(results));',
    ].join('\n');
    const probe = spawnSync(process.execPath, ['--import', 'tsx', '--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    if (probe.error || probe.status !== 0)
      throw new Error(`Native tree-sitter probe failed: ${probe.error?.message ?? probe.stderr}`);
    nativeProbe = JSON.parse(probe.stdout);
  });

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

  it.each(peerOverrideCases)('uses the native %s grammar under the shared tree-sitter runtime', (grammar, _file, _content, expectedNames) => {
    const symbols = nativeProbe[grammar];
    expect(symbols.map(symbol => symbol.name)).toEqual(expect.arrayContaining(expectedNames));
    expect(symbols.every(symbol => symbol.parser === `tree-sitter:${grammar}`)).toBe(true);
    expect(symbols.every(symbol => symbol.confidence === 0.95)).toBe(true);
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
