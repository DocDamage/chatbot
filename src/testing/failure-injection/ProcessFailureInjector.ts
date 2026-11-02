/**
 * Process Failure Injector (RT-HARNESS-003)
 * Provides deterministic simulation of subprocess failures, timeouts, OOM, crash, and disk full.
 */

export interface FailureInjectionOptions {
  simulatedExitCode?: number;
  simulatedError?: string;
  delayMs?: number;
  crashAfterMs?: number;
  corruptStdout?: boolean;
  corruptStderr?: boolean;
  simulateDiskFull?: boolean;
  simulateOOM?: boolean;
  simulateTimeout?: boolean;
}

export class ProcessFailureInjector {
  private activeOverrides = new Map<string, FailureInjectionOptions>();

  public setRule(commandPattern: string, options: FailureInjectionOptions): void {
    this.activeOverrides.set(commandPattern, options);
  }

  public clearRule(commandPattern: string): void {
    this.activeOverrides.delete(commandPattern);
  }

  public clearAll(): void {
    this.activeOverrides.clear();
  }

  public findRule(command: string): FailureInjectionOptions | undefined {
    for (const [pattern, options] of this.activeOverrides.entries()) {
      if (command.includes(pattern)) {
        return options;
      }
    }
    return undefined;
  }

  public async interceptExecution<T>(
    command: string,
    executeActual: () => Promise<T>,
  ): Promise<T> {
    const rule = this.findRule(command);
    if (!rule) {
      return executeActual();
    }

    if (rule.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    }

    if (rule.simulateTimeout) {
      throw new Error(`[ProcessFailureInjector] Execution timed out for command: ${command}`);
    }

    if (rule.simulateDiskFull) {
      throw new Error(`[ProcessFailureInjector] ENOSPC: no space left on device while executing: ${command}`);
    }

    if (rule.simulateOOM) {
      throw new Error(`[ProcessFailureInjector] Process killed due to Out-Of-Memory (OOM): ${command}`);
    }

    if (rule.simulatedExitCode && rule.simulatedExitCode !== 0) {
      throw new Error(`[ProcessFailureInjector] Process exited with non-zero code ${rule.simulatedExitCode}: ${rule.simulatedError || 'Simulated failure'}`);
    }

    if (rule.simulatedError) {
      throw new Error(`[ProcessFailureInjector] ${rule.simulatedError}`);
    }

    return executeActual();
  }
}

export const failureInjector = new ProcessFailureInjector();
