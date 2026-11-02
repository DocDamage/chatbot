import { ProcessFailureInjector, failureInjector } from '../ProcessFailureInjector';

describe('RT-FAIL-001: ProcessFailureInjector Simulation Suite', () => {
  let injector: ProcessFailureInjector;

  beforeEach(() => {
    injector = new ProcessFailureInjector();
  });

  afterEach(() => {
    injector.clearAll();
    failureInjector.clearAll();
  });

  it('passes through execution when no rules match', async () => {
    const fn = jest.fn().mockResolvedValue('normal result');
    const res = await injector.interceptExecution('npm test', fn);

    expect(res).toBe('normal result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('simulates non-zero exit code failure', async () => {
    injector.setRule('gradle build', { simulatedExitCode: 1, simulatedError: 'Compilation failed' });

    const fn = jest.fn().mockResolvedValue('success');
    await expect(injector.interceptExecution('gradle build app', fn))
      .rejects.toThrow('Process exited with non-zero code 1: Compilation failed');
    expect(fn).not.toHaveBeenCalled();
  });

  it('simulates timeouts, disk full (ENOSPC), and OOM failures', async () => {
    injector.setRule('timeout-cmd', { simulateTimeout: true });
    injector.setRule('disk-cmd', { simulateDiskFull: true });
    injector.setRule('oom-cmd', { simulateOOM: true });

    const fn = jest.fn().mockResolvedValue('success');

    await expect(injector.interceptExecution('run timeout-cmd', fn))
      .rejects.toThrow('Execution timed out');
    await expect(injector.interceptExecution('run disk-cmd', fn))
      .rejects.toThrow('ENOSPC: no space left on device');
    await expect(injector.interceptExecution('run oom-cmd', fn))
      .rejects.toThrow('Process killed due to Out-Of-Memory');
  });

  it('simulates generic errors and execution delays', async () => {
    injector.setRule('error-cmd', { simulatedError: 'Custom failure error' });
    injector.setRule('delay-cmd', { delayMs: 10 });

    const fn = jest.fn().mockResolvedValue('delayed success');

    await expect(injector.interceptExecution('error-cmd', fn))
      .rejects.toThrow('Custom failure error');

    const delayed = await injector.interceptExecution('delay-cmd', fn);
    expect(delayed).toBe('delayed success');
  });

  it('clears specific rules and clears all rules', () => {
    injector.setRule('cmd1', { simulateTimeout: true });
    injector.setRule('cmd2', { simulateOOM: true });

    expect(injector.findRule('cmd1')).toBeDefined();
    expect(injector.findRule('cmd2')).toBeDefined();

    injector.clearRule('cmd1');
    expect(injector.findRule('cmd1')).toBeUndefined();
    expect(injector.findRule('cmd2')).toBeDefined();

    injector.clearAll();
    expect(injector.findRule('cmd2')).toBeUndefined();
  });

  it('exports shared failureInjector singleton instance', () => {
    expect(failureInjector).toBeInstanceOf(ProcessFailureInjector);
  });
});
