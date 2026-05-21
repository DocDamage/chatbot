import { RoleplayBoundaryState, RoleplaySessionState } from './CreativeTypes';

export type RoleplayTurn = {
  id?: string;
  speaker: string;
  text: string;
  mode?: 'ic' | 'ooc' | 'narration';
};

export type RoleplaySession = RoleplaySessionState & {
  id: string;
  paused: boolean;
  turnHistory: RoleplayTurn[];
  parentSessionId?: string;
  branchName?: string;
};

export class RoleplaySessionEngine {
  private sessions = new Map<string, RoleplaySession>();
  private nextId = 1;

  start(state: RoleplaySessionState & { boundaries?: RoleplayBoundaryState }): RoleplaySession {
    const session: RoleplaySession = {
      ...state,
      id: state.sessionId || `rp-${this.nextId++}`,
      sessionId: state.sessionId || `rp-${this.nextId - 1}`,
      activeCast: state.activeCast || [],
      goals: state.goals || [],
      inventory: state.inventory || [],
      paused: false,
      turnHistory: [],
    };
    this.sessions.set(session.id, session);
    return this.clone(session);
  }

  get(id: string): RoleplaySession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Roleplay session not found: ${id}`);
    }
    return this.clone(session);
  }

  recordTurn(id: string, turn: RoleplayTurn): RoleplaySession {
    const session = this.mustGet(id);
    session.turnHistory.push({ ...turn, id: turn.id || `turn-${session.turnHistory.length + 1}` });
    return this.clone(session);
  }

  pause(id: string): RoleplaySession {
    const session = this.mustGet(id);
    session.paused = true;
    return this.clone(session);
  }

  resume(id: string): RoleplaySession {
    const session = this.mustGet(id);
    session.paused = false;
    return this.clone(session);
  }

  branch(id: string, branchName: string): RoleplaySession {
    const current = this.mustGet(id);
    const branch: RoleplaySession = {
      ...current,
      id: `rp-${this.nextId++}`,
      sessionId: `rp-${this.nextId - 1}`,
      parentSessionId: current.id,
      branchName,
      turnHistory: [...current.turnHistory],
      paused: false,
    };
    this.sessions.set(branch.id, branch);
    return this.clone(branch);
  }

  reset(id: string): RoleplaySession {
    const session = this.mustGet(id);
    session.turnHistory = [];
    session.paused = false;
    return this.clone(session);
  }

  summarize(id: string): string {
    const session = this.mustGet(id);
    return [
      `Session: ${session.id}`,
      `Scene: ${session.sceneLocation || 'unspecified'}`,
      `Cast: ${(session.activeCast || []).join(', ') || 'unspecified'}`,
      `Goals: ${(session.goals || []).join(', ') || 'none'}`,
      `Turns: ${session.turnHistory.length}`,
    ].join('\n');
  }

  private mustGet(id: string): RoleplaySession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Roleplay session not found: ${id}`);
    }
    return session;
  }

  private clone(session: RoleplaySession): RoleplaySession {
    return {
      ...session,
      activeCast: [...(session.activeCast || [])],
      goals: [...(session.goals || [])],
      inventory: [...(session.inventory || [])],
      turnHistory: session.turnHistory.map(turn => ({ ...turn })),
      boundaries: session.boundaries
        ? {
            ...session.boundaries,
            hardLimits: [...(session.boundaries.hardLimits || [])],
            disallowedThemes: [...(session.boundaries.disallowedThemes || [])],
            allowedMatureThemes: [...(session.boundaries.allowedMatureThemes || [])],
          }
        : undefined,
    };
  }
}
