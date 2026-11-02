/**
 * Adapter Failure Matrix & Resiliency Engine (PX20-T05)
 * Handles, verifies, and simulates failure modes across:
 * - Local model server unreachable / unresponsive
 * - Database / Redis connectivity drop
 * - Artifact store / disk full (low disk refusal)
 * - Media / Image / Audio worker crash
 * - FFmpeg / OCR / TTS / STT tool binary failure
 * - Godot / Unity / Unreal editor disconnect
 * - Browser / Dev server crash
 * - Capability pack version mismatch
 * - Memory / vector index corruption
 * - Network timeout
 * - GPU out-of-memory (VRAM exhaustion)
 * - Hub application shutdown during active job
 */

export type FailureScenarioType =
  | 'local_model_unreachable'
  | 'database_unavailable'
  | 'disk_full'
  | 'media_worker_crash'
  | 'binary_missing_or_failed'
  | 'engine_disconnect'
  | 'browser_crash'
  | 'pack_version_mismatch'
  | 'index_corruption'
  | 'network_timeout'
  | 'gpu_oom'
  | 'shutdown_during_job';

export interface FailureHandlingRule {
  scenario: FailureScenarioType;
  name: string;
  timeoutMs: number;
  fallbackAction: 'fail_safe' | 'retry_backoff' | 'fallback_to_template' | 'quarantine' | 'refuse_gracefully';
  userMessage: string;
  remediationAction: string;
  isFatal: boolean;
}

export interface SimulatedFailureResult {
  scenario: FailureScenarioType;
  handledSuccessfully: boolean;
  actionTaken: string;
  durationMs: number;
  errorMessage: string;
  remediationGuidance: string;
}

export class AdapterFailureMatrix {
  private static instance: AdapterFailureMatrix;
  private rules: Map<FailureScenarioType, FailureHandlingRule> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  public static getInstance(): AdapterFailureMatrix {
    if (!AdapterFailureMatrix.instance) {
      AdapterFailureMatrix.instance = new AdapterFailureMatrix();
    }
    return AdapterFailureMatrix.instance;
  }

  private registerDefaultRules(): void {
    const rules: FailureHandlingRule[] = [
      {
        scenario: 'local_model_unreachable',
        name: 'Local Model Server Unreachable',
        timeoutMs: 3000,
        fallbackAction: 'fallback_to_template',
        userMessage: 'Local model server is offline or not responding.',
        remediationAction: 'Check local model runner endpoint configuration or switch to cloud provider.',
        isFatal: false
      },
      {
        scenario: 'disk_full',
        name: 'Disk Space Exhaustion',
        timeoutMs: 500,
        fallbackAction: 'refuse_gracefully',
        userMessage: 'Low disk space detected; refusing new artifact writes.',
        remediationAction: 'Run storage cleanup or allocate additional disk space.',
        isFatal: true
      },
      {
        scenario: 'gpu_oom',
        name: 'GPU VRAM Out Of Memory',
        timeoutMs: 1000,
        fallbackAction: 'fail_safe',
        userMessage: 'Insufficient GPU VRAM available for the requested model/worker.',
        remediationAction: 'Unload unused models or reduce context/batch sizes.',
        isFatal: false
      },
      {
        scenario: 'engine_disconnect',
        name: 'Game Engine Editor Disconnect',
        timeoutMs: 2000,
        fallbackAction: 'quarantine',
        userMessage: 'Game engine editor disconnected during sync.',
        remediationAction: 'Reopen Godot/Unity project and verify language server / bridge port.',
        isFatal: false
      },
      {
        scenario: 'media_worker_crash',
        name: 'Media / Audio Worker Process Crash',
        timeoutMs: 1500,
        fallbackAction: 'retry_backoff',
        userMessage: 'Media worker terminated unexpectedly.',
        remediationAction: 'Verify input file integrity and sufficient RAM allocation.',
        isFatal: false
      },
      {
        scenario: 'binary_missing_or_failed',
        name: 'Tool Binary (FFmpeg/OCR) Missing',
        timeoutMs: 500,
        fallbackAction: 'fail_safe',
        userMessage: 'Required system tool binary was not found or failed execution.',
        remediationAction: 'Run Capability Guided Doctor to install missing dependencies.',
        isFatal: false
      },
      {
        scenario: 'browser_crash',
        name: 'Browser Automation Subprocess Crash',
        timeoutMs: 2000,
        fallbackAction: 'fail_safe',
        userMessage: 'Browser automation instance crashed during navigation.',
        remediationAction: 'Inspect URL safety and retry in isolated sandbox profile.',
        isFatal: false
      },
      {
        scenario: 'database_unavailable',
        name: 'Relational Database / Persistence Drop',
        timeoutMs: 5000,
        fallbackAction: 'retry_backoff',
        userMessage: 'Database connection interrupted.',
        remediationAction: 'Verify SQLite file permissions or PostgreSQL connection pool.',
        isFatal: true
      },
      {
        scenario: 'pack_version_mismatch',
        name: 'Capability Pack Schema Incompatibility',
        timeoutMs: 500,
        fallbackAction: 'quarantine',
        userMessage: 'Capability pack version is incompatible with current hub core.',
        remediationAction: 'Update capability pack manifest or core hub version.',
        isFatal: false
      },
      {
        scenario: 'index_corruption',
        name: 'Memory / Vector Index Corruption',
        timeoutMs: 1000,
        fallbackAction: 'quarantine',
        userMessage: 'Vector index integrity check failed.',
        remediationAction: 'Trigger automatic index re-anchoring and rebuild from source.',
        isFatal: false
      },
      {
        scenario: 'network_timeout',
        name: 'External Provider Network Timeout',
        timeoutMs: 10000,
        fallbackAction: 'retry_backoff',
        userMessage: 'Upstream network request timed out.',
        remediationAction: 'Check internet connectivity or proxy configuration.',
        isFatal: false
      },
      {
        scenario: 'shutdown_during_job',
        name: 'Unexpected Hub Application Shutdown',
        timeoutMs: 0,
        fallbackAction: 'fail_safe',
        userMessage: 'Application was restarted while job was in progress.',
        remediationAction: 'Durable recovery reconciled job status; review output artifacts.',
        isFatal: false
      }
    ];

    for (const r of rules) {
      this.rules.set(r.scenario, r);
    }
  }

  public getRule(scenario: FailureScenarioType): FailureHandlingRule | undefined {
    return this.rules.get(scenario);
  }

  public listRules(): FailureHandlingRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluates and resolves a failure scenario.
   */
  public handleFailure(scenario: FailureScenarioType, error?: Error): SimulatedFailureResult {
    const rule = this.rules.get(scenario);
    if (!rule) {
      return {
        scenario,
        handledSuccessfully: false,
        actionTaken: 'unhandled_fatal_error',
        durationMs: 0,
        errorMessage: error?.message || 'Unknown failure scenario',
        remediationGuidance: 'Check system logs.'
      };
    }

    return {
      scenario,
      handledSuccessfully: true,
      actionTaken: rule.fallbackAction,
      durationMs: rule.timeoutMs,
      errorMessage: rule.userMessage + (error ? ` Detail: ${error.message}` : ''),
      remediationGuidance: rule.remediationAction
    };
  }
}
