/**
 * Release Cutover Orchestrator (CRK-P26-T08)
 *
 * Implements the rigorous 11-step production cutover verification sequence
 * before enabling Canonical ChatRuntime by default (§3860-3875).
 */

import {
  ReleaseCutoverChecklist,
  CutoverDecision,
} from '../../types/knowledge-maintenance';

export class ReleaseCutoverOrchestrator {
  private checklist: ReleaseCutoverChecklist = {
    shadowComparisonPassed: false,
    goldenSuitePassed: false,
    defaultPackAbEvidenceRecorded: false,
    databaseMigrationsVerified: false,
    rollbackFlagTested: false,
    stagingGatePassed: false,
    canaryUserBetaPassed: false,
    diagnosticsInspected: false,
    canonicalRuntimeEnabledDefault: false,
    rollbackWindowActive: false,
    legacyDecommissionScheduled: false,
  };

  /**
   * Update checklist step status
   */
  public updateStep<K extends keyof ReleaseCutoverChecklist>(
    step: K,
    passed: boolean
  ): void {
    this.checklist[step] = passed;
  }

  public getChecklist(): Readonly<ReleaseCutoverChecklist> {
    return { ...this.checklist };
  }

  /**
   * Evaluates whether the canonical runtime is authorized to be enabled by default (§3864-3872)
   */
  public evaluateCutoverDecision(): CutoverDecision {
    const requiredPrerequisites: Array<{ key: keyof ReleaseCutoverChecklist; label: string }> = [
      { key: 'shadowComparisonPassed', label: '1. Shadow Mode Comparison Verification' },
      { key: 'goldenSuitePassed', label: '2. Golden Conversation Suite Verification' },
      { key: 'defaultPackAbEvidenceRecorded', label: '3. Default Pack A/B Evidence' },
      { key: 'databaseMigrationsVerified', label: '4. Database Migration Verification' },
      { key: 'rollbackFlagTested', label: '5. Fast Rollback Flag Readiness' },
      { key: 'stagingGatePassed', label: '6. Staging Gate Passed' },
      { key: 'canaryUserBetaPassed', label: '7. Canary Users / Internal Beta Passed' },
      { key: 'diagnosticsInspected', label: '8. Diagnostics & Telemetry Inspected' },
    ];

    const blockingSteps: string[] = [];
    let completedSteps = 0;

    for (const prereq of requiredPrerequisites) {
      if (this.checklist[prereq.key]) {
        completedSteps++;
      } else {
        blockingSteps.push(prereq.label);
      }
    }

    const canCutover = blockingSteps.length === 0;

    return {
      canCutover,
      completedSteps,
      totalSteps: requiredPrerequisites.length,
      blockingSteps,
    };
  }

  /**
   * Executes cutover: activates canonical runtime as default and activates rollback safety window (§3872-3873)
   */
  public executeCutover(): void {
    const decision = this.evaluateCutoverDecision();
    if (!decision.canCutover) {
      throw new Error(
        `Cannot execute cutover. Blocking steps: ${decision.blockingSteps.join('; ')}`
      );
    }

    this.checklist.canonicalRuntimeEnabledDefault = true;
    this.checklist.rollbackWindowActive = true;
  }

  /**
   * Triggers rollback to legacy compatibility path if issues detected during window (§3873)
   */
  public rollbackCutover(reason: string): void {
    if (!this.checklist.rollbackWindowActive) {
      throw new Error('Rollback window is not active or has already closed');
    }

    this.checklist.canonicalRuntimeEnabledDefault = false;
  }
}
