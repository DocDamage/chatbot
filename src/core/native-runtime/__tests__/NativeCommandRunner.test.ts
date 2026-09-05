import { runNativeCommand } from '../NativeCommandRunner';

describe('runNativeCommand', () => {
  it('captures stdout, stderr, exit code, environment, and spawn callback', async () => {
    const onSpawn = jest.fn();
    const result = await runNativeCommand(process.execPath, [
      '-e', 'process.stdout.write(process.env.OLLAMA_MODEL || ""); process.stderr.write("warning"); process.exitCode=3'
    ], { timeoutMs: 5_000, env: { ...process.env, OLLAMA_MODEL: 'ready' }, onSpawn });
    expect(result).toMatchObject({ exitCode: 3, stdout: 'ready', stderr: 'warning' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(onSpawn).toHaveBeenCalledTimes(1);
  });

  it('rejects a timed-out command', async () => {
    await expect(runNativeCommand(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)'], { timeoutMs: 50 }))
      .rejects.toThrow('timed out after 50ms');
  });

  it('rejects an executable spawn error', async () => {
    await expect(runNativeCommand('definitely-not-a-real-native-command', [], { timeoutMs: 1_000 }))
      .rejects.toThrow();
  });

  it('uses default options and preserves only the bounded output tail', async () => {
    const result = await runNativeCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(2000100))']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toHaveLength(2_000_000);
  });
});
