/**
 * Canonical Workflow State Repository (CRK-P04-T02)
 *
 * Persists and manages active workflow execution state per session (§1131-1144):
 * - Workflow ID and version
 * - Active step and step outputs
 * - Pending and committed approvals
 * - Failures and cancellation status
 * - Resumable lifecycle transitions
 */

import { WorkflowExecutionState } from '../../types/workflow';

export class WorkflowStateRepository {
  private readonly states = new Map<string, WorkflowExecutionState>();

  public async getState(sessionId: string): Promise<WorkflowExecutionState | null> {
    const state = this.states.get(sessionId);
    if (!state) return null;
    return JSON.parse(JSON.stringify(state));
  }

  public async saveState(state: WorkflowExecutionState): Promise<void> {
    this.states.set(state.sessionId, JSON.parse(JSON.stringify(state)));
  }

  public async deleteState(sessionId: string): Promise<boolean> {
    return this.states.delete(sessionId);
  }

  public async updateActiveStep(
    sessionId: string,
    stepId: string,
    stepOutput?: { key: string; value: unknown }
  ): Promise<WorkflowExecutionState | null> {
    const state = await this.getState(sessionId);
    if (!state) return null;

    state.activeStepId = stepId;
    state.updatedAt = new Date().toISOString();
    if (stepOutput) {
      state.stepOutputs[stepOutput.key] = stepOutput.value;
    }
    await this.saveState(state);
    return state;
  }

  public async markCancelled(sessionId: string, reason?: string): Promise<WorkflowExecutionState | null> {
    const state = await this.getState(sessionId);
    if (!state) return null;

    state.status = 'cancelled';
    state.cancelled = true;
    state.cancelReason = reason || 'User requested cancellation';
    state.updatedAt = new Date().toISOString();
    await this.saveState(state);
    return state;
  }

  public async recordFailure(sessionId: string, stepId: string, error: string): Promise<void> {
    const state = await this.getState(sessionId);
    if (!state) return;

    state.failures.push({
      stepId,
      error,
      timestamp: new Date().toISOString(),
    });
    state.status = 'failed';
    state.updatedAt = new Date().toISOString();
    await this.saveState(state);
  }

  public async clear(): Promise<void> {
    this.states.clear();
  }
}
