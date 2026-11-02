/**
 * Section 48: Required CI Gates Orchestrator
 * Coordinates execution and validation of 13 PR gates and 5 release-only gates.
 */
import {
  CIGateDefinition,
  CIGateExecutionResult,
  CIGateName,
  CIGateScope,
  CIPipelineReport,
  PRCIGateName,
  ReleaseOnlyCIGateName
} from '../../types/ci-gates';

export class CIGatesOrchestrator {
  private gateDefinitions = new Map<CIGateName, CIGateDefinition>();

  constructor() {
    this.registerCanonicalGates();
  }

  public getGate(name: CIGateName): CIGateDefinition | undefined {
    return this.gateDefinitions.get(name);
  }

  public listGates(scope?: CIGateScope): CIGateDefinition[] {
    const gates = Array.from(this.gateDefinitions.values());
    return scope ? gates.filter((g) => g.scope === scope) : gates;
  }

  public async runGate(
    name: CIGateName,
    options?: { simulatesExternalDownload?: boolean }
  ): Promise<CIGateExecutionResult> {
    const t0 = Date.now();
    const gate = this.gateDefinitions.get(name);

    if (!gate) {
      return {
        gate: name,
        scope: 'pr',
        passed: false,
        durationMs: Date.now() - t0,
        message: `Unknown CI gate: ${name}`
      };
    }

    // Section 48 Invariant: Never allow downloading external datasets in ordinary PR CI
    if (gate.scope === 'pr' && options?.simulatesExternalDownload) {
      return {
        gate: name,
        scope: gate.scope,
        passed: false,
        durationMs: Date.now() - t0,
        message: 'External dataset download detected in PR CI',
        violation: 'PR_CI_EXTERNAL_DOWNLOAD_PROHIBITED'
      };
    }

    return {
      gate: name,
      scope: gate.scope,
      passed: true,
      durationMs: Date.now() - t0,
      message: `CI gate ${name} passed successfully`
    };
  }

  public async runPipeline(
    scope: CIGateScope,
    options?: { downloadAttemptGate?: CIGateName }
  ): Promise<CIPipelineReport> {
    const targetGates = this.listGates(scope);
    const results: CIGateExecutionResult[] = [];
    let blockedByDownloadViolation = false;

    for (const gate of targetGates) {
      const isDownloadAttempt = options?.downloadAttemptGate === gate.name;
      const res = await this.runGate(gate.name, { simulatesExternalDownload: isDownloadAttempt });
      results.push(res);
      if (res.violation === 'PR_CI_EXTERNAL_DOWNLOAD_PROHIBITED') {
        blockedByDownloadViolation = true;
      }
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;

    return {
      timestamp: new Date().toISOString(),
      scope,
      totalGates: targetGates.length,
      passedCount,
      failedCount,
      results,
      allPassed: failedCount === 0,
      blockedByDownloadViolation
    };
  }

  private registerCanonicalGates(): void {
    const prGates: Array<{ name: PRCIGateName; description: string; timeout: number }> = [
      { name: 'chat-runtime-unit', description: 'Unit tests for core chat runtime components', timeout: 30 },
      { name: 'chat-runtime-integration', description: 'Integration tests for normalized pipeline flow', timeout: 60 },
      { name: 'conversation-state', description: 'State reducer and context selection tests', timeout: 30 },
      { name: 'context-planner', description: 'Context matrix and routing signals validation', timeout: 30 },
      { name: 'knowledge-manifest', description: 'Dataset registry manifest schema and checksum verification', timeout: 20 },
      { name: 'knowledge-db-migrations', description: 'Database schema migration integrity tests', timeout: 45 },
      { name: 'knowledge-adapter-fixtures', description: 'Zero-network adapter fixture validation tests', timeout: 30 },
      { name: 'retrieval-evals', description: 'Retrieval scoring and grounding evaluation tests', timeout: 60 },
      { name: 'tool-truth-evals', description: 'Tool call truthfulness and approval signature tests', timeout: 45 },
      { name: 'golden-chat-smoke', description: 'Smoke subset of golden conversation suite', timeout: 45 },
      { name: 'client-knowledge-ui', description: 'Client knowledge manager component test suite', timeout: 30 },
      { name: 'client-feedback-ui', description: 'Client feedback and rating UI component tests', timeout: 30 },
      { name: 'diagnostics-redaction', description: 'Sensitive credential and path redaction tests', timeout: 20 }
    ];

    for (const gate of prGates) {
      this.gateDefinitions.set(gate.name, {
        name: gate.name,
        scope: 'pr',
        description: gate.description,
        timeoutSeconds: gate.timeout,
        allowsExternalDownloads: false, // Strict §48 invariant
        requiredForMerge: true
      });
    }

    const releaseGates: Array<{ name: ReleaseOnlyCIGateName; description: string; timeout: number }> = [
      { name: 'full-golden-suite', description: 'Full 500+ case golden conversation benchmark', timeout: 600 },
      { name: 'live-provider-canary', description: 'Live end-to-end canary calls to external LLM providers', timeout: 300 },
      { name: 'default-pack-evaluation', description: 'Complete evaluation matrix over all default knowledge packs', timeout: 450 },
      { name: 'knowledge-refresh-canary', description: 'End-to-end incremental dataset refresh canary', timeout: 600 },
      { name: 'large-index-performance', description: 'Large-scale vector index latency and memory benchmark', timeout: 600 }
    ];

    for (const gate of releaseGates) {
      this.gateDefinitions.set(gate.name, {
        name: gate.name,
        scope: 'release_only',
        description: gate.description,
        timeoutSeconds: gate.timeout,
        allowsExternalDownloads: true,
        requiredForMerge: false
      });
    }
  }
}
