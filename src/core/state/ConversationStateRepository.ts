/**
 * Canonical Conversation State Repository (CRK-P03-T05)
 *
 * Persists conversation state and structured variables scoped strictly to the session.
 * Guarantees privacy boundaries: variables are never automatically promoted to
 * user-wide durable memory (§1064). Supports atomic cascading deletion when
 * a session is deleted (§1066).
 */

import { ConversationState, ConversationVariable } from '../../types/conversation-state';
import { Database } from '../database/Database';

export class ConversationStateRepository {
  private readonly states = new Map<string, ConversationState>();

  constructor(private readonly database?: Database) {}

  public async getState(sessionId: string): Promise<ConversationState | null> {
    const state = this.database
      ? JSON.parse((await this.database.query('SELECT state_json FROM conversation_states WHERE session_id = ?', [sessionId])).rows[0]?.state_json || 'null') as ConversationState | null
      : this.states.get(sessionId);
    if (!state) return null;
    return JSON.parse(JSON.stringify(state));
  }

  public async saveState(state: ConversationState): Promise<void> {
    if (this.database) {
      await this.database.query(
        'INSERT INTO conversation_states (session_id, state_json) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET state_json = excluded.state_json',
        [state.sessionId, JSON.stringify(state)]
      );
      return;
    }
    this.states.set(state.sessionId, JSON.parse(JSON.stringify(state)));
  }

  public async deleteState(sessionId: string): Promise<boolean> {
    if (this.database) return (await this.database.query('DELETE FROM conversation_states WHERE session_id = ?', [sessionId])).rowCount > 0;
    return this.states.delete(sessionId);
  }

  public async getVariables(sessionId: string): Promise<Record<string, ConversationVariable>> {
    const state = await this.getState(sessionId);
    return state ? (state.variables as Record<string, ConversationVariable>) : {};
  }

  public async setVariable(sessionId: string, variable: ConversationVariable): Promise<void> {
    let state = await this.getState(sessionId);
    const now = new Date().toISOString();
    if (!state) {
      state = {
        sessionId,
        variables: {},
        sessionMemory: { sessionId, messages: [], maxHistoryTurns: 50 },
        createdAt: now,
        updatedAt: now,
      };
    }
    state.variables[variable.key] = variable;
    state.updatedAt = now;
    await this.saveState(state);
  }

  public async clear(): Promise<void> {
    if (this.database) await this.database.query('DELETE FROM conversation_states');
    this.states.clear();
  }
}
