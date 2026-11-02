/**
 * Typed Agent Team Roles & Authority Matrix (CF-05)
 * Roles are capabilities, not personalities. Each role defines the minimum toolset
 * and authority required to perform its function.
 */

export type AgentTeamRole =
  | 'repository_analyst'
  | 'planner'
  | 'implementer'
  | 'test_author'
  | 'reviewer'
  | 'security_reviewer'
  | 'integration_supervisor';

export interface RoleDescriptor {
  role: AgentTeamRole;
  description: string;
  readOnly: boolean;
  requiresWorktree: boolean;
  allowedActions: string[];
}

export const ROLE_DESCRIPTORS: Record<AgentTeamRole, RoleDescriptor> = {
  repository_analyst: {
    role: 'repository_analyst',
    description: 'Read-only structural repository inspection, symbol index querying, and architecture mapping',
    readOnly: true,
    requiresWorktree: false,
    allowedActions: [
      'read_file',
      'list_files',
      'search_code',
      'query_architecture',
      'query_symbols',
      'query_retrieval'
    ]
  },
  planner: {
    role: 'planner',
    description: 'High-level requirements decomposition, dependency graph creation, and task envelopment',
    readOnly: true,
    requiresWorktree: false,
    allowedActions: [
      'read_file',
      'list_files',
      'create_plan',
      'decompose_tasks',
      'estimate_budget'
    ]
  },
  implementer: {
    role: 'implementer',
    description: 'Code mutation and patch creation strictly confined to an isolated worktree',
    readOnly: false,
    requiresWorktree: true,
    allowedActions: [
      'read_file',
      'write_file',
      'delete_file',
      'create_patch',
      'run_local_build'
    ]
  },
  test_author: {
    role: 'test_author',
    description: 'Test authoring and validation strictly confined to an isolated worktree',
    readOnly: false,
    requiresWorktree: true,
    allowedActions: [
      'read_file',
      'write_file',
      'run_tests',
      'create_patch',
      'parse_diagnostics'
    ]
  },
  reviewer: {
    role: 'reviewer',
    description: 'Read-only code quality, architecture invariants, and style review',
    readOnly: true,
    requiresWorktree: false,
    allowedActions: [
      'read_file',
      'review_patch',
      'comment',
      'approve_or_reject'
    ]
  },
  security_reviewer: {
    role: 'security_reviewer',
    description: 'Read-only security analysis, secret detection, path traversal, and vulnerability review',
    readOnly: true,
    requiresWorktree: false,
    allowedActions: [
      'read_file',
      'analyze_findings',
      'scan_secrets',
      'review_security',
      'approve_or_reject_security'
    ]
  },
  integration_supervisor: {
    role: 'integration_supervisor',
    description: 'Team task scheduling, budget enforcement, bundle assembly (cannot bypass reviewer approvals)',
    readOnly: true,
    requiresWorktree: false,
    allowedActions: [
      'schedule_tasks',
      'track_budgets',
      'assemble_bundle',
      'cancel_all',
      'request_merge'
    ]
  }
};

export class AgentRoleAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentRoleAuthorityError';
  }
}

export function assertRoleAuthority(role: AgentTeamRole, action: string): void {
  const descriptor = ROLE_DESCRIPTORS[role];
  if (!descriptor) {
    throw new AgentRoleAuthorityError(`Unknown role '${role}'`);
  }
  if (!descriptor.allowedActions.includes(action)) {
    throw new AgentRoleAuthorityError(
      `Role '${role}' is not authorized to perform action '${action}'. Allowed: [${descriptor.allowedActions.join(', ')}]`
    );
  }
}
