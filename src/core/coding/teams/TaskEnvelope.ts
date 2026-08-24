/**
 * Immutable Task Envelope & Cryptographic Integrity (CF-05)
 * Defines the immutable contract for a single task assigned to an agent role,
 * including authority bounds, budgets, inputs, success criteria, and cryptographic digest.
 */

import * as crypto from 'crypto';
import { AgentTeamRole, ROLE_DESCRIPTORS } from './AgentTeamRoles';

export interface TaskBudget {
  maxTokens?: number;
  maxTimeMs?: number;
  maxDiskBytes?: number;
  maxCommands?: number;
}

export interface TaskAuthority {
  allowedActions: string[];
  readOnly: boolean;
  allowedScopes: string[];
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskResult {
  taskId: string;
  workerId: string;
  success: boolean;
  outputs: Record<string, any>;
  patches?: Array<{ path: string; content?: string; patchContent?: string }>;
  tokensUsed: number;
  timeTakenMs: number;
  commandsRun: number;
  completedAt: string;
  evidence?: string[];
  error?: string;
}

export interface TaskEnvelope {
  readonly taskId: string;
  readonly role: AgentTeamRole;
  readonly title: string;
  readonly description: string;
  readonly scope: string[];
  readonly inputs: Record<string, any>;
  readonly successCriteria: string[];
  readonly dependencies: string[];
  readonly authority: TaskAuthority;
  readonly budget: TaskBudget;
  readonly approvalDigest: string;
  readonly createdAt: string;
  status: TaskStatus;
  assignedWorkerId?: string;
  result?: TaskResult;
  error?: string;
}

export interface CreateTaskEnvelopeOptions {
  taskId?: string;
  role: AgentTeamRole;
  title: string;
  description: string;
  scope?: string[];
  inputs?: Record<string, any>;
  successCriteria?: string[];
  dependencies?: string[];
  budget?: TaskBudget;
  allowedActions?: string[];
  allowedScopes?: string[];
}

export class TaskEnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskEnvelopeValidationError';
  }
}

/**
 * Deterministically compute the SHA-256 digest of envelope fields
 */
export function computeEnvelopeDigest(data: {
  taskId: string;
  role: AgentTeamRole;
  title: string;
  description: string;
  scope: string[];
  inputs: Record<string, any>;
  successCriteria: string[];
  dependencies: string[];
  authority: TaskAuthority;
  budget: TaskBudget;
  createdAt: string;
}): string {
  const normalized = {
    taskId: data.taskId,
    role: data.role,
    title: data.title,
    description: data.description,
    scope: [...data.scope].sort(),
    inputs: Object.keys(data.inputs).sort().reduce((acc: any, key) => {
      acc[key] = data.inputs[key];
      return acc;
    }, {}),
    successCriteria: [...data.successCriteria],
    dependencies: [...data.dependencies].sort(),
    authority: {
      readOnly: data.authority.readOnly,
      allowedActions: [...data.authority.allowedActions].sort(),
      allowedScopes: [...data.authority.allowedScopes].sort()
    },
    budget: data.budget,
    createdAt: data.createdAt
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Construct and sign an immutable TaskEnvelope
 */
export function createTaskEnvelope(options: CreateTaskEnvelopeOptions): TaskEnvelope {
  const taskId = options.taskId || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const role = options.role;
  const roleDesc = ROLE_DESCRIPTORS[role];
  if (!roleDesc) {
    throw new TaskEnvelopeValidationError(`Invalid role '${role}'`);
  }

  const scope = options.scope || ['*'];
  const inputs = options.inputs || {};
  const successCriteria = options.successCriteria || [];
  const dependencies = options.dependencies || [];
  const createdAt = new Date().toISOString();

  const authority: TaskAuthority = {
    readOnly: roleDesc.readOnly,
    allowedActions: options.allowedActions || [...roleDesc.allowedActions],
    allowedScopes: options.allowedScopes || [...scope]
  };

  const budget: TaskBudget = {
    maxTokens: options.budget?.maxTokens ?? 50000,
    maxTimeMs: options.budget?.maxTimeMs ?? 120000,
    maxDiskBytes: options.budget?.maxDiskBytes ?? 50 * 1024 * 1024,
    maxCommands: options.budget?.maxCommands ?? 10
  };

  const approvalDigest = computeEnvelopeDigest({
    taskId,
    role,
    title: options.title,
    description: options.description,
    scope,
    inputs,
    successCriteria,
    dependencies,
    authority,
    budget,
    createdAt
  });

  return {
    taskId,
    role,
    title: options.title,
    description: options.description,
    scope,
    inputs,
    successCriteria,
    dependencies,
    authority,
    budget,
    approvalDigest,
    createdAt,
    status: 'pending'
  };
}

/**
 * Verify that the TaskEnvelope has not been tampered with
 */
export function verifyTaskEnvelope(envelope: TaskEnvelope): boolean {
  const expected = computeEnvelopeDigest({
    taskId: envelope.taskId,
    role: envelope.role,
    title: envelope.title,
    description: envelope.description,
    scope: envelope.scope,
    inputs: envelope.inputs,
    successCriteria: envelope.successCriteria,
    dependencies: envelope.dependencies,
    authority: envelope.authority,
    budget: envelope.budget,
    createdAt: envelope.createdAt
  });

  return expected === envelope.approvalDigest;
}
