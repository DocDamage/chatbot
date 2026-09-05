/**
 * Bounded Capability Health & Diagnostics Service (PX-02 / PX02-T09)
 * Executes non-destructive, timeout-bounded health checks across connectivity,
 * model availability, binary paths, memory constraints, and storage capacity.
 */

export interface HealthCheckResult {
  checkId: string;
  name: string;
  passed: boolean;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface CapabilityHealthSnapshot {
  capabilityId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  checkedAt: string;
  totalDurationMs: number;
  checks: HealthCheckResult[];
  degradedReasons: string[];
}

export type HealthCheckFn = () => Promise<{ passed: boolean; message?: string; details?: Record<string, unknown> }>;

export class CapabilityHealthDiagnostics {
  private static instance: CapabilityHealthDiagnostics;
  private customChecks = new Map<string, HealthCheckFn>();
  private snapshots = new Map<string, CapabilityHealthSnapshot>();

  public static getInstance(): CapabilityHealthDiagnostics {
    if (!CapabilityHealthDiagnostics.instance) {
      CapabilityHealthDiagnostics.instance = new CapabilityHealthDiagnostics();
    }
    return CapabilityHealthDiagnostics.instance;
  }

  public registerCheck(capabilityId: string, checkId: string, fn: HealthCheckFn): void {
    this.customChecks.set(`${capabilityId}:${checkId}`, fn);
  }

  public async runDiagnostics(capabilityId: string, timeoutMs: number = 3000): Promise<CapabilityHealthSnapshot> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    const degradedReasons: string[] = [];

    // Find all checks for this capability
    const relevantKeys = Array.from(this.customChecks.keys()).filter(k => k.startsWith(`${capabilityId}:`));

    if (relevantKeys.length === 0) {
      // Default ping check
      checks.push({
        checkId: 'default-ping',
        name: 'Basic Capability Liveness',
        passed: true,
        latencyMs: 1,
        message: 'No custom diagnostic checks registered; default liveness OK'
      });
    } else {
      for (const key of relevantKeys) {
        const checkId = key.split(':')[1];
        const fn = this.customChecks.get(key)!;
        const checkStart = Date.now();
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        try {
          // Wrap with timeout
          const checkPromise = fn();
          const timeoutPromise = new Promise<{ passed: boolean; message?: string; details?: Record<string, unknown> }>((_, reject) =>
            { timeoutHandle = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs); }
          );

          const result = await Promise.race([checkPromise, timeoutPromise]);
          const latency = Date.now() - checkStart;

          checks.push({
            checkId,
            name: checkId,
            passed: result.passed,
            latencyMs: latency,
            message: result.message,
            details: result.details
          });

          if (!result.passed) {
            degradedReasons.push(result.message || `Check ${checkId} failed`);
          }
        } catch (err: any) {
          checks.push({
            checkId,
            name: checkId,
            passed: false,
            latencyMs: Date.now() - checkStart,
            message: err.message
          });
          degradedReasons.push(err.message);
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const allPassed = checks.every(c => c.passed);
    const status = allPassed ? 'healthy' : (checks.some(c => c.passed) ? 'degraded' : 'unhealthy');

    const snapshot: CapabilityHealthSnapshot = {
      capabilityId,
      status,
      checkedAt: new Date().toISOString(),
      totalDurationMs,
      checks,
      degradedReasons
    };

    this.snapshots.set(capabilityId, snapshot);
    return snapshot;
  }

  public getLatestSnapshot(capabilityId: string): CapabilityHealthSnapshot | undefined {
    return this.snapshots.get(capabilityId);
  }

  public clear(): void {
    this.customChecks.clear();
    this.snapshots.clear();
  }
}
