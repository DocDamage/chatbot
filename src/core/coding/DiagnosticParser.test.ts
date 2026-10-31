import { DiagnosticParser } from './verification/DiagnosticParser';

describe('DiagnosticParser', () => {
  it('normalizes common compiler and tool output', () => {
    const diagnostics = new DiagnosticParser().parse('tsc', 'src/app.ts(4,9): error TS2322: Type string is not assignable\nerror[E0308]: mismatched types');
    expect(diagnostics[0]).toMatchObject({ file: 'src/app.ts', line: 4, column: 9, severity: 'error', code: 'TS2322' });
    expect(diagnostics[1]).toMatchObject({ severity: 'error', code: 'E0308' });
  });

  it('normalizes gcc, rustc, Go, pytest, and MSVC locations', () => {
    const output = [
      'src/main.c:8:3: warning: implicit declaration',
      'src/lib.rs:12:7: error[E0308]: mismatched types',
      'pkg/server.go:20:4: undefined: missing',
      'tests/test_cart.py:14: error: assert 4 == 5',
      'src\\App.cs(31,9): error CS1002: ; expected'
    ].join('\n');
    const diagnostics = new DiagnosticParser().parse('compiler', output);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'src/main.c', line: 8, column: 3, severity: 'warning' }),
      expect.objectContaining({ file: 'src/lib.rs', line: 12, column: 7, severity: 'error', code: 'E0308' }),
      expect.objectContaining({ file: 'pkg/server.go', line: 20, column: 4, severity: 'error' }),
      expect.objectContaining({ file: 'tests/test_cart.py', line: 14, severity: 'error' }),
      expect.objectContaining({ file: 'src\\App.cs', line: 31, column: 9, code: 'CS1002' })
    ]));
  });
  it('retains Node assertion differences and runtime errors instead of sending only stack frames to repair', () => {
    const result = new DiagnosticParser().parse('node', [
      'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:',
      "+ 'Hello, Ada'", "- 'Hello, Ada!'", 'at TestContext.<anonymous> (C:\\project\\check.cjs:12:3)',
      'at Test.run (node:internal/test_runner/test:111:4)', 'TypeError: t.end is not a function',
    ].join('\n'));
    expect(result[0]).toMatchObject({ code: 'ERR_ASSERTION', file: 'C:\\project\\check.cjs', line: 12 });
    expect(result[0].raw).toContain("- 'Hello, Ada!'");
    expect(result.some(item => item.message.includes('t.end is not a function'))).toBe(true);
    expect(result.some(item => item.message.startsWith('at Test.run'))).toBe(false);
  });
});
