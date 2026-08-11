import { RepairController } from './RepairController';

describe('RepairController', () => {
  it('repairs from diagnostics and stops at the configured bound', async () => {
    let calls = 0;
    const result = await new RepairController(3).run({
      verify: async () => [{ command: 'compiler', argv: ['compiler'], exitCode: calls++ === 0 ? 1 : 0, durationMs: 1, diagnostics: calls === 1 ? [{ tool: 'compiler', severity: 'error', message: 'missing symbol', raw: 'missing symbol' }] : [], stdout: '', stderr: '', status: calls === 1 ? 'failed' : 'passed' }],
      propose: async diagnostics => diagnostics.length ? { hypothesis: 'Define the missing symbol', operations: [{ operation: 'modify', path: 'src/app.ts', content: 'fixed', reason: 'Resolve compiler diagnostic', authorized: true }] } : undefined,
      apply: async () => undefined
    });
    expect(result.status).toBe('passed');
    expect(result.attempts[0].diagnosticDelta.resolved).toBe(1);
  });

  it('reports failure instead of looping forever', async () => {
    const result = await new RepairController(2).run({
      verify: async () => [{ command: 'compiler', argv: ['compiler'], exitCode: 1, durationMs: 1, diagnostics: [{ tool: 'compiler', severity: 'error', message: 'still broken', raw: 'still broken' }], stdout: '', stderr: '', status: 'failed' }],
      propose: async () => ({ hypothesis: 'Try bounded repair', operations: [{ operation: 'modify', path: 'a.ts', content: 'x', reason: 'repair', authorized: true }] }),
      apply: async () => undefined
    });
    expect(result.status).toBe('failed');
    expect(result.attempts).toHaveLength(2);
  });
});
