import { VerificationRunner } from './VerificationRunner';

describe('VerificationRunner', () => {
  it('returns structured verification status and commands run', async () => {
    const commandRunner = {
      run: jest.fn().mockResolvedValue({
        success: true,
        command: 'npm run type-check',
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 5
      })
    };
    const runner = new VerificationRunner(commandRunner as any);

    const result = await runner.runTypeCheck();

    expect(result.status).toBe('passed');
    expect(result.commandsRun).toEqual(['npm run type-check']);
    expect(result.results[0].command).toBe('npm run type-check');
  });

  it('runs the standard verification suite in order', async () => {
    const commandRunner = {
      run: jest.fn().mockResolvedValue({
        success: true,
        command: 'ok',
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: 1
      })
    };
    const runner = new VerificationRunner(commandRunner as any);

    const result = await runner.runStandardSuite();

    expect(result.status).toBe('passed');
    expect(result.commandsRun).toEqual([
      'npm run type-check',
      'npm run lint',
      'npm test -- --runInBand'
    ]);
  });
});
