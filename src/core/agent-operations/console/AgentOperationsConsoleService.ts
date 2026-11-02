/**
 * Agent Operations Console & Budget Controller (PX-06 / PX06-T06 & PX06-T07)
 * Central management service for active agent sessions, task execution,
 * workspace claim tracking, multi-agent communication, resource budget enforcement,
 * and emergency stop-all controls.
 */

import {
  AgentSession,
  AgentEvent,
  AgentStage,
  AgentToolCategory,
  AgentSessionHelper,
  CreateAgentSessionOptions
} from '../contracts/AgentOperationsSchema';
import { AgentCommunicationHub } from '../communication/AgentCommunicationHub';
import { WorkspaceClaimService } from '../claims/WorkspaceClaimService';
import { ProcessTreeSupervisor } from '../../coding/teams/ProcessTreeSupervisor';

export interface ConsoleSummary {
  activeSessionCount: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  totalActiveClaims: number;
  activeThreadsCount: number;
  sessions: AgentSession[];
}

export class AgentOperationsConsoleService {
  private sessions: Map<string, AgentSession> = new Map();
  private events: Map<string, AgentEvent[]> = new Map();
  private maxAgentsPerProject = 10;

  constructor(
    public readonly communicationHub: AgentCommunicationHub = new AgentCommunicationHub(),
    public readonly claimService: WorkspaceClaimService = new WorkspaceClaimService()
  ) {}

  /**
   * Start a new managed agent session
   */
  public startSession(options: CreateAgentSessionOptions): AgentSession {
    const projectSessions = this.listSessionsForProject(options.projectId, true);
    if (projectSessions.length >= this.maxAgentsPerProject) {
      throw new Error(
        `Max active agents limit reached for project '${options.projectId}' (${this.maxAgentsPerProject} max).`
      );
    }

    const session = AgentSessionHelper.createSession(options);
    this.sessions.set(session.sessionId, session);
    this.events.set(session.sessionId, []);

    this.communicationHub.registerAgent(session.agentId, session.role);

    this.recordEvent(
      session.sessionId,
      'lifecycle',
      'system',
      `Agent session started with role '${session.role}'`
    );

    return session;
  }

  /**
   * Transition session stage
   */
  public transitionStage(sessionId: string, newStage: AgentStage, toolCategory?: AgentToolCategory): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);
    if (session.state !== 'active') throw new Error(`Cannot transition stage for session in state '${session.state}'.`);

    const prevStage = session.currentStage;
    session.currentStage = newStage;
    if (toolCategory) {
      session.currentToolCategory = toolCategory;
    }
    session.lastActivityAt = new Date().toISOString();

    this.recordEvent(
      sessionId,
      'stage_transition',
      toolCategory || 'system',
      `Stage transitioned from '${prevStage}' to '${newStage}'`
    );
  }

  /**
   * Record resource consumption and verify budget boundaries
   */
  public recordUsage(
    sessionId: string,
    usage: { tokens?: number; timeMs?: number; commands?: number; diskBytes?: number; costUsd?: number }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);

    if (usage.tokens) session.resourceUsage.tokensUsed += usage.tokens;
    if (usage.timeMs) session.resourceUsage.timeSpentMs += usage.timeMs;
    if (usage.commands) session.resourceUsage.commandsRun += usage.commands;
    if (usage.diskBytes) session.resourceUsage.diskBytesUsed = usage.diskBytes;
    if (usage.costUsd) session.resourceUsage.estimatedCostUsd += usage.costUsd;

    session.lastActivityAt = new Date().toISOString();

    // Enforce budgets
    if (session.resourceUsage.tokensUsed > session.budget.maxTokens) {
      this.cancelSession(sessionId, `Token budget exceeded (${session.resourceUsage.tokensUsed} > ${session.budget.maxTokens})`);
      throw new Error(`Session '${sessionId}' cancelled: token budget exceeded.`);
    }

    if (session.resourceUsage.commandsRun > session.budget.maxCommands) {
      this.cancelSession(sessionId, `Command execution budget exceeded (${session.resourceUsage.commandsRun} > ${session.budget.maxCommands})`);
      throw new Error(`Session '${sessionId}' cancelled: command budget exceeded.`);
    }

    if (session.resourceUsage.timeSpentMs > session.budget.maxTimeMs) {
      this.cancelSession(sessionId, `Execution time budget exceeded (${session.resourceUsage.timeSpentMs}ms > ${session.budget.maxTimeMs}ms)`);
      throw new Error(`Session '${sessionId}' cancelled: time budget exceeded.`);
    }
  }

  /**
   * Record an event for a session
   */
  public recordEvent(
    sessionId: string,
    eventType: AgentEvent['eventType'],
    toolCategory: AgentToolCategory,
    summary: string,
    details?: Record<string, any>
  ): AgentEvent {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);

    const event = AgentSessionHelper.createEvent(session, eventType, toolCategory, summary, details);
    const list = this.events.get(sessionId) || [];
    list.push(event);
    this.events.set(sessionId, list);
    return event;
  }

  /**
   * Pause an active session
   */
  public pauseSession(sessionId: string, reason?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);
    if (session.state !== 'active') return;

    session.state = 'paused';
    session.lastActivityAt = new Date().toISOString();
    this.recordEvent(sessionId, 'lifecycle', 'system', `Session paused: ${reason || 'User requested'}`);
  }

  /**
   * Resume a paused session
   */
  public resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);
    if (session.state !== 'paused') return;

    session.state = 'active';
    session.lastActivityAt = new Date().toISOString();
    this.recordEvent(sessionId, 'lifecycle', 'system', 'Session resumed');
  }

  /**
   * Complete an active session
   */
  public completeSession(sessionId: string, artifacts: string[] = []): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);

    session.state = 'completed';
    session.currentStage = 'idle';
    session.endedAt = new Date().toISOString();
    session.artifacts = [...session.artifacts, ...artifacts];

    this.claimService.releaseAllForSession(sessionId);
    this.communicationHub.unregisterAgent(session.agentId);

    this.recordEvent(sessionId, 'lifecycle', 'system', `Session completed successfully with ${artifacts.length} artifacts`);
  }

  /**
   * Cancel an active or paused session
   */
  public cancelSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'cancelled';
    session.endedAt = new Date().toISOString();
    session.error = reason;

    this.claimService.releaseAllForSession(sessionId);
    this.communicationHub.unregisterAgent(session.agentId);

    this.recordEvent(sessionId, 'lifecycle', 'system', `Session cancelled: ${reason}`);
  }

  /**
   * Emergency stop-all: terminates all active sessions, kills child processes, releases claims
   */
  public stopAll(projectId?: string, reason = 'Operator triggered emergency stop-all'): number {
    let cancelledCount = 0;

    for (const session of this.sessions.values()) {
      if (projectId && session.projectId !== projectId) continue;
      if (session.state === 'active' || session.state === 'paused') {
        this.cancelSession(session.sessionId, reason);
        cancelledCount++;
      }
    }

    // Terminate any registered child process trees
    ProcessTreeSupervisor.terminateAll();

    return cancelledCount;
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get events for a session
   */
  public getSessionEvents(sessionId: string): AgentEvent[] {
    return this.events.get(sessionId) || [];
  }

  /**
   * List sessions for a project
   */
  public listSessionsForProject(projectId: string, activeOnly = false): AgentSession[] {
    return Array.from(this.sessions.values()).filter(s => {
      if (s.projectId !== projectId) return false;
      if (activeOnly) return s.state === 'active' || s.state === 'paused';
      return true;
    });
  }

  /**
   * Get console overview summary
   */
  public getConsoleSummary(projectId: string): ConsoleSummary {
    const sessions = this.listSessionsForProject(projectId);
    const activeSessions = sessions.filter(s => s.state === 'active' || s.state === 'paused');
    const totalTokens = sessions.reduce((acc, s) => acc + s.resourceUsage.tokensUsed, 0);
    const totalCost = sessions.reduce((acc, s) => acc + s.resourceUsage.estimatedCostUsd, 0);
    const claims = this.claimService.listClaimsForProject(projectId);

    return {
      activeSessionCount: activeSessions.length,
      totalTokensUsed: totalTokens,
      totalCostUsd: Number(totalCost.toFixed(4)),
      totalActiveClaims: claims.length,
      activeThreadsCount: 0,
      sessions
    };
  }
}
