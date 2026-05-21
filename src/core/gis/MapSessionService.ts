import { MapSessionState, SavedMapSession } from '../../types/gis';

export class MapSessionService {
  private readonly sessions = new Map<string, SavedMapSession>();

  save(state: MapSessionState): SavedMapSession {
    const now = new Date().toISOString();
    const id = `map-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const session: SavedMapSession = {
      id,
      title: state.title,
      state,
      createdAt: now,
      updatedAt: now
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): SavedMapSession | undefined {
    return this.sessions.get(id);
  }

  list(): SavedMapSession[] {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  update(id: string, state: MapSessionState): SavedMapSession {
    const current = this.sessions.get(id);
    if (!current) {
      throw new Error(`Map session not found: ${id}`);
    }

    const next: SavedMapSession = {
      ...current,
      title: state.title,
      state,
      updatedAt: new Date().toISOString()
    };
    this.sessions.set(id, next);
    return next;
  }
}
