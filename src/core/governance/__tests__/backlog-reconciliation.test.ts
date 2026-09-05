import { describe, it, expect } from '@jest/globals';
import { BacklogReconciliationOrchestrator } from '../BacklogReconciliationOrchestrator';

describe('BacklogReconciliationOrchestrator (§55, §63)', () => {
  it('should track all canonical phases and specifications through 63', () => {
    const orchestrator = new BacklogReconciliationOrchestrator();
    const summary = orchestrator.calculateSummary();

    // 3 inventory tasks + 26 phases + 33 specifications = 62 total tasks
    expect(summary.totalTasks).toBe(62);
    expect(summary.blockingTasks).toBeGreaterThan(50);
    expect(summary.allBlockingVerified).toBe(true);
    expect(summary.completionPercentage).toBe(100);
  });

  it('should verify presence of Phase 51 through 63 in the canonical backlog', () => {
    const orchestrator = new BacklogReconciliationOrchestrator();
    expect(orchestrator.getTask('CRK-SPEC-51')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-52')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-53')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-54')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-55')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-56')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-57')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-58')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-59')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-60')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-61')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-62')).toBeDefined();
    expect(orchestrator.getTask('CRK-SPEC-63')).toBeDefined();
  });

  it('should generate an audit report certifying release candidate readiness', () => {
    const orchestrator = new BacklogReconciliationOrchestrator();
    const report = orchestrator.generateAuditReport('178224d');

    expect(report.isReadyForReleaseCandidate).toBe(true);
    expect(report.certifiedCommit).toBe('178224d');
    expect(report.summary.allBlockingVerified).toBe(true);
  });

  it('should reject release candidate readiness if any blocking task is pending', () => {
    const orchestrator = new BacklogReconciliationOrchestrator();
    orchestrator.updateTaskStatus('CRK-SPEC-51', 'PENDING');

    const summary = orchestrator.calculateSummary();
    expect(summary.allBlockingVerified).toBe(false);

    const report = orchestrator.generateAuditReport('178224d');
    expect(report.isReadyForReleaseCandidate).toBe(false);
  });
});
