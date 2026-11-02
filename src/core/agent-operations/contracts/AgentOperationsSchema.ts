/**
 * Normalized Agent Operations Schema (PX-06 / PX06-T01)
 * Normalized contracts for AgentSession, AgentEvent, AgentThread, WorkspaceClaim,
 * Stage tracking, Tool Categories, and Resource Budgets.
 */

import * as crypto from 'crypto';
import { AgentTeamRole } from '../../coding/teams/AgentTeamRoles';
import { TaskEnvelope } from '../../coding/teams/TaskEnvelope';
import { AgentPrivacyRedactor } from '../privacy/AgentPrivacyRedactor';

export type AgentProviderClient =
  | 'codex'
  | 'claude_code'
  | 'opencode'
  | 'internal_agent'
  | 'custom_client';

export type AgentSessionState =
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentToolCategory =
  | 'file_system'
  | 'git_operation'
  | 'symbol_retrieval'
  | 'architecture_query'
  | 'command_execution'
  | 'model_inference'
  | 'communication'
  | 'system';

export type AgentStage =
  | 'init'
  | 'planning'
  | 'analysis'
  | 'implementation'
  | 'testing'
  | 'review'
  | 'integration'
  | 'idle';

export interface AgentResourceUsage {
  tokensUsed: number;
  timeSpentMs: number;
  commandsRun: number;
  diskBytesUsed: number;
  estimatedCostUsd: number;
}

export interface AgentSessionPermissions {
  readOnly: boolean;
  allowedTools: string[];
  allowedScopes: string[];
  requiresApprovalForMutation: boolean;
}

export interface AgentEvent {
  eventId: string;
  sessionId: string;
  agentId: string;
  role: AgentTeamRole;
  timestamp: string;
  stage: AgentStage;
  toolCategory: AgentToolCategory;
  eventType: 'stage_transition' | 'tool_call' | 'tool_result' | 'message' | 'approval_request' | 'error' | 'lifecycle';
  summary: string;
  details?: Record<string, any>;
  redacted: boolean;
}

export interface AgentSession {
  sessionId: string;
  agentId: string;
  role: AgentTeamRole;
  providerClient: AgentProviderClient;
  ownerId: string;
  projectId: string;
  repository?: string;
  worktreePath?: string;
  branch?: string;
  state: AgentSessionState;
  currentStage: AgentStage;
  currentToolCategory?: AgentToolCategory;
  taskEnvelope?: TaskEnvelope;
  permissions: AgentSessionPermissions;
  resourceUsage: AgentResourceUsage;
  budget: {
    maxTokens: number;
    maxTimeMs: number;
    maxCommands: number;
    maxDiskBytes: number;
    maxCostUsd?: number;
  };
  approvalState: 'none' | 'pending' | 'approved' | 'rejected';
  approvalDigest?: string;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string;
  artifacts: string[];
  error?: string;
}

export interface CreateAgentSessionOptions {
  sessionId?: string;
  agentId: string;
  role: AgentTeamRole;
  providerClient?: AgentProviderClient;
  ownerId: string;
  projectId: string;
  repository?: string;
  worktreePath?: string;
  branch?: string;
  taskEnvelope?: TaskEnvelope;
  permissions?: Partial<AgentSessionPermissions>;
  budget?: Partial<AgentSession['budget']>;
}

/**
 * Factory and helper methods for AgentSession & AgentEvent
 */
export class AgentSessionHelper {
  public static createSession(options: CreateAgentSessionOptions): AgentSession {
    const sessionId = options.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    return {
      sessionId,
      agentId: options.agentId,
      role: options.role,
      providerClient: options.providerClient || 'internal_agent',
      ownerId: options.ownerId,
      projectId: options.projectId,
      repository: options.repository,
      worktreePath: options.worktreePath,
      branch: options.branch,
      state: 'active',
      currentStage: 'init',
      taskEnvelope: options.taskEnvelope,
      permissions: {
        readOnly: options.permissions?.readOnly ?? (options.role === 'reviewer' || options.role === 'repository_analyst' || options.role === 'planner'),
        allowedTools: options.permissions?.allowedTools || ['read_file', 'list_files'],
        allowedScopes: options.permissions?.allowedScopes || ['*'],
        requiresApprovalForMutation: options.permissions?.requiresApprovalForMutation ?? true
      },
      resourceUsage: {
        tokensUsed: 0,
        timeSpentMs: 0,
        commandsRun: 0,
        diskBytesUsed: 0,
        estimatedCostUsd: 0
      },
      budget: {
        maxTokens: options.budget?.maxTokens ?? 100000,
        maxTimeMs: options.budget?.maxTimeMs ?? 300000,
        maxCommands: options.budget?.maxCommands ?? 20,
        maxDiskBytes: options.budget?.maxDiskBytes ?? 100 * 1024 * 1024,
        maxCostUsd: options.budget?.maxCostUsd ?? 2.0
      },
      approvalState: 'none',
      startedAt: now,
      lastActivityAt: now,
      artifacts: []
    };
  }

  public static createEvent(
    session: AgentSession,
    eventType: AgentEvent['eventType'],
    toolCategory: AgentToolCategory,
    summary: string,
    details?: Record<string, any>
  ): AgentEvent {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const redactedDetails = details ? AgentPrivacyRedactor.redactObject(details) : undefined;
    const redactedSummary = AgentPrivacyRedactor.redactString(summary);

    return {
      eventId,
      sessionId: session.sessionId,
      agentId: session.agentId,
      role: session.role,
      timestamp: new Date().toISOString(),
      stage: session.currentStage,
      toolCategory,
      eventType,
      summary: redactedSummary,
      details: redactedDetails,
      redacted: true
    };
  }

  public static computeSessionDigest(session: AgentSession): string {
    const payload = {
      sessionId: session.sessionId,
      agentId: session.agentId,
      role: session.role,
      ownerId: session.ownerId,
      projectId: session.projectId,
      taskDigest: session.taskEnvelope?.approvalDigest,
      startedAt: session.startedAt,
      budget: session.budget
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
