import { DiagnosticParser } from './verification/DiagnosticParser';

describe('DiagnosticParser', () => {
  it('normalizes common compiler and tool output', () => {
    const diagnostics = new DiagnosticParser().parse('tsc', 'src/app.ts(4,9): error TS2322: Type string is not assignable\nerror[E0308]: mismatched types');
    expect(diagnostics[0]).toMatchObject({ file: 'src/app.ts', line: 4, column: 9, severity: 'error', code: 'TS2322' });
    expect(diagnostics[1]).toMatchObject({ severity: 'error', code: 'E0308' });
  });
});
