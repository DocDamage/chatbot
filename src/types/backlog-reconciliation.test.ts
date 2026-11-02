import { describe, it, expect } from '@jest/globals';
import {
  BacklogTaskStatus,
  BacklogTask,
  BacklogAuditReport,
} from './backlog-reconciliation';

describe('BacklogReconciliation Types', () => {
  it('should validate BacklogTaskStatus values', () => {
    const statuses: BacklogTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'VERIFIED', 'BLOCKED'];
    expect(statuses).toHaveLength(4);
  });

  it('should validate BacklogAuditReport structure', () => {
    const task: BacklogTask = {
      id: 'CRK-SPEC-55',
      title: 'Initial Implementation Backlog Summary',
      isBlocking: true,
      phaseOrSpec: 'SPEC-55',
      status: 'VERIFIED',
      verifiedEvidenceRef: 'docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-51-55/',
    };

    const report: BacklogAuditReport = {
      summary: {
        totalTasks: 1,
        verifiedTasks: 1,
        blockingTasks: 1,
        blockingVerified: 1,
        allBlockingVerified: true,
        completionPercentage: 100,
      },
      tasks: [task],
      timestamp: new Date().toISOString(),
      certifiedCommit: '178224d',
      isReadyForReleaseCandidate: true,
    };

    expect(report.isReadyForReleaseCandidate).toBe(true);
    expect(report.summary.completionPercentage).toBe(100);
  });
});
