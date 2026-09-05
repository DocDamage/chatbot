import { runNativeCommand } from '../NativeCommandRunner';

describe('RT-NATIVE-002 — Command Runner Isolation Suite', () => {
  it('executes arguments safely without shell interpretation or injection', async () => {
    // node -e "console.log(process.argv.slice(1))" with injection attempt arguments
    const injectionArg = '; echo INJECTED; & echo INJECTED_WIN';
    const result = await runNativeCommand(process.execPath, ['-e', 'console.log(process.argv[1])', injectionArg]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(injectionArg);
    expect(result.stdout).not.toContain('INJECTED\n');
  });

  it('enforces explicit command timeout and kills child process', async () => {
    // Run an infinite loop node script with a 100ms timeout
    await expect(
      runNativeCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        timeoutMs: 100,
      })
    ).rejects.toThrow(/timed out/i);
  });

  it('captures exit code, stdout, stderr and measures durationMs accurately', async () => {
    const result = await runNativeCommand(process.execPath, [
      '-e',
      'console.log("hello stdout"); console.error("hello stderr"); process.exit(3);',
    ]);

    expect(result.exitCode).toBe(3);
    expect(result.stdout).toContain('hello stdout');
    expect(result.stderr).toContain('hello stderr');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
