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
  it.each(['blocked', 'skipped'] as const)('does not claim success for %s verification with no diagnostics', async status => {
    const propose = jest.fn();
    const result = await new RepairController().run({ verify: async () => [{ status, command: 'check', argv: [], exitCode: null, durationMs: 0, diagnostics: [], stdout: '', stderr: '' }], propose, apply: jest.fn() });
    expect(result.status).toBe('blocked'); expect(propose).not.toHaveBeenCalled();
  });
  it('does not claim success when no verification ran', async () => {
    const result = await new RepairController().run({ verify: async () => [], propose: jest.fn(), apply: jest.fn() });
    expect(result.status).toBe('blocked');
  });
  it('reports model errors as blocked and preserves the actual verification outcome', async () => {
    const verify = async () => [{ status: 'failed' as const, command: 'check', argv: [], exitCode: 1, durationMs: 0, diagnostics: [], stdout: '', stderr: 'test failed' }];
    const result = await new RepairController().run({ verify, propose: async () => { throw new Error('Provider offline'); }, apply: jest.fn() });
    expect(result.status).toBe('blocked'); expect(result.remainingRisks.join(' ')).toContain('Provider offline');
  });
});
