/**
 * Workspace & Worktree Claim Service (PX-06 / PX06-T04)
 * Coordinates mutual exclusion and advisory locks for agent worktrees,
 * branch claims, path scopes, and task executions.
 */

export interface WorkspaceClaim {
  claimId: string;
  agentId: string;
  sessionId: string;
  projectId: string;
  repository?: string;
  worktreePath?: string;
  branch?: string;
  pathScope: string[]; // e.g. ['src/core/auth/**', 'src/core/sec/**']
  taskId: string;
  exclusive: boolean;
  acquiredAt: string;
  expiresAt: string;
  lastHeartbeatAt: string;
  metadata?: Record<string, any>;
}

export interface AcquireClaimOptions {
  claimId?: string;
  agentId: string;
  sessionId: string;
  projectId: string;
  repository?: string;
  worktreePath?: string;
  branch?: string;
  pathScope?: string[];
  taskId: string;
  exclusive?: boolean;
  leaseTtlMs?: number;
  metadata?: Record<string, any>;
}

export class WorkspaceClaimConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictingClaim: WorkspaceClaim
  ) {
    super(message);
    this.name = 'WorkspaceClaimConflictError';
  }
}

export class WorkspaceClaimService {
  private claims: Map<string, WorkspaceClaim> = new Map();
  private readonly DEFAULT_LEASE_TTL_MS = 60000; // 1 minute

  /**
   * Acquire a workspace/worktree claim
   */
  public acquireClaim(options: AcquireClaimOptions): WorkspaceClaim {
    this.reapStaleClaims();

    const claimId = options.claimId || `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const leaseTtl = options.leaseTtlMs || this.DEFAULT_LEASE_TTL_MS;
    const expiresAt = new Date(now.getTime() + leaseTtl).toISOString();
    const pathScope = options.pathScope || ['*'];
    const exclusive = options.exclusive ?? true;

    // Check for collisions
    for (const existing of this.claims.values()) {
      if (existing.projectId !== options.projectId) {
        continue;
      }

      // Check for worktree collision
      if (
        options.worktreePath &&
        existing.worktreePath &&
        options.worktreePath === existing.worktreePath &&
        existing.agentId !== options.agentId
      ) {
        throw new WorkspaceClaimConflictError(
          `Conflict: Worktree path '${options.worktreePath}' is already claimed by agent '${existing.agentId}' (claim ${existing.claimId})`,
          existing
        );
      }

      // Check for branch collision if exclusive
      if (
        options.branch &&
        existing.branch &&
        options.branch === existing.branch &&
        exclusive &&
        existing.agentId !== options.agentId
      ) {
        throw new WorkspaceClaimConflictError(
          `Conflict: Branch '${options.branch}' is already claimed exclusively by agent '${existing.agentId}'`,
          existing
        );
      }

      // Check for path scope collision if both are exclusive and scopes overlap
      if (exclusive && existing.exclusive && existing.agentId !== options.agentId) {
        if (this.doScopesOverlap(pathScope, existing.pathScope)) {
          throw new WorkspaceClaimConflictError(
            `Conflict: Path scope [${pathScope.join(', ')}] overlaps with existing exclusive claim [${existing.pathScope.join(', ')}] held by agent '${existing.agentId}'`,
            existing
          );
        }
      }
    }

    const claim: WorkspaceClaim = {
      claimId,
      agentId: options.agentId,
      sessionId: options.sessionId,
      projectId: options.projectId,
      repository: options.repository,
      worktreePath: options.worktreePath,
      branch: options.branch,
      pathScope,
      taskId: options.taskId,
      exclusive,
      acquiredAt: now.toISOString(),
      expiresAt,
      lastHeartbeatAt: now.toISOString(),
      metadata: options.metadata
    };

    this.claims.set(claimId, claim);
    return claim;
  }

  /**
   * Refresh the heartbeat/lease of an existing claim
   */
  public heartbeat(claimId: string, agentId: string, extendTtlMs = this.DEFAULT_LEASE_TTL_MS): boolean {
    const claim = this.claims.get(claimId);
    if (!claim) return false;
    if (claim.agentId !== agentId) return false;

    const now = new Date();
    claim.lastHeartbeatAt = now.toISOString();
    claim.expiresAt = new Date(now.getTime() + extendTtlMs).toISOString();
    return true;
  }

  /**
   * Release an acquired claim
   */
  public releaseClaim(claimId: string, agentId: string): boolean {
    const claim = this.claims.get(claimId);
    if (!claim) return false;
    if (claim.agentId !== agentId) return false;

    return this.claims.delete(claimId);
  }

  /**
   * Release all claims belonging to a specific session or agent
   */
  public releaseAllForSession(sessionId: string): number {
    let released = 0;
    for (const [id, claim] of this.claims.entries()) {
      if (claim.sessionId === sessionId) {
        this.claims.delete(id);
        released++;
      }
    }
    return released;
  }

  /**
   * Find active claims for a project
   */
  public listClaimsForProject(projectId: string): WorkspaceClaim[] {
    this.reapStaleClaims();
    return Array.from(this.claims.values()).filter(c => c.projectId === projectId);
  }

  /**
   * Clean up expired claims
   */
  public reapStaleClaims(): number {
    const now = new Date().getTime();
    let reaped = 0;
    for (const [id, claim] of this.claims.entries()) {
      if (new Date(claim.expiresAt).getTime() <= now) {
        this.claims.delete(id);
        reaped++;
      }
    }
    return reaped;
  }

  /**
   * Check if two path scope glob arrays overlap
   */
  private doScopesOverlap(scopeA: string[], scopeB: string[]): boolean {
    if (scopeA.includes('*') || scopeB.includes('*')) return true;

    for (const a of scopeA) {
      for (const b of scopeB) {
        const cleanA = a.replace(/[*\\/]+$/, '');
        const cleanB = b.replace(/[*\\/]+$/, '');
        if (cleanA.startsWith(cleanB) || cleanB.startsWith(cleanA)) {
          return true;
        }
      }
    }
    return false;
  }
}
