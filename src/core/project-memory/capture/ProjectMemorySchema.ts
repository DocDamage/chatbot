/**
 * Project Memory Record Schema & Types (PX-05 / PX05-T01)
 *
 * Defines durable branch/commit/symbol-aware project memory entities with provenance,
 * confidence scores, approval state, freshness lifecycle, and tenant isolation.
 */

export type MemoryKind =
  | 'decision'
  | 'gotcha'
  | 'convention'
  | 'flow'
  | 'milestone'
  | 'failure'
  | 'fix'
  | 'context'
  | 'preference'
  | 'changelog'
  | 'note';

export type MemoryCaptureMethod =
  | 'explicit_user'
  | 'task_handoff'
  | 'adr_ingestion'
  | 'pr_review'
  | 'session_summary'
  | 'failure_fix_mined';

export type MemoryApprovalState = 'proposed' | 'approved' | 'rejected';

export type MemoryFreshnessState =
  | 'current'
  | 'possibly_stale'
  | 'stale'
  | 'superseded'
  | 'quarantined'
  | 'deleted';

export interface MemorySourceEvidence {
  filePath?: string;
  startLine?: number;
  endLine?: number;
  symbolName?: string;
  commitHash?: string;
  fileDigest?: string;
  excerptSnippet?: string;
  citationUrl?: string;
}

export interface ProjectMemoryRecord {
  id: string;
  ownerId: string;
  projectId?: string;
  repositoryId?: string;
  branch: string;
  worktree?: string;
  originatingCommit: string;
  kind: MemoryKind;
  title: string;
  content: string;
  evidence: MemorySourceEvidence[];
  relatedFiles: string[];
  relatedSymbols: string[];
  confidence: number;
  captureMethod: MemoryCaptureMethod;
  approvalState: MemoryApprovalState;
  freshnessState: MemoryFreshnessState;
  supersededBy?: string;
  supersedes?: string[];
  isProtected?: boolean;
  retentionClass: 'permanent' | 'milestone' | 'session' | 'transient';
  createdAt: string;
  updatedAt: string;
  authorId: string;
  accessScope: 'user_only' | 'project_shared' | 'global';
  tags: string[];
}
