import { CommandRunner } from './CommandRunner';

describe('CommandRunner', () => {
  it('rejects commands outside the allowlist', async () => {
    const runner = new CommandRunner(process.cwd(), {
      allowedCommands: ['node --version'],
      timeoutMs: 1000
    });

    const result = await runner.run('npm install');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('runs allowlisted commands with stdout and stderr separated', async () => {
    const runner = new CommandRunner(process.cwd(), {
      allowedCommands: ['node --version'],
      timeoutMs: 3000
    });

    const result = await runner.run('node --version');

    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/^v/);
    expect(result.stderr).toBe('');
  });
});
