/**
 * Initial Implementation Backlog Reconciliation Schemas and Types (Section 55)
 *
 * Provides master tracking, release-blocking verification, and certification
 * across CRK Phases 00 through 26 and Specifications 31 through 55.
 */

export type BacklogTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'BLOCKED';

export interface BacklogTask {
  id: string;
  title: string;
  isBlocking: boolean;
  phaseOrSpec: string;
  status: BacklogTaskStatus;
  verifiedEvidenceRef?: string;
}

export interface BacklogSummary {
  totalTasks: number;
  verifiedTasks: number;
  blockingTasks: number;
  blockingVerified: number;
  allBlockingVerified: boolean;
  completionPercentage: number;
}

export interface BacklogAuditReport {
  summary: BacklogSummary;
  tasks: BacklogTask[];
  timestamp: string;
  certifiedCommit: string;
  isReadyForReleaseCandidate: boolean;
}
