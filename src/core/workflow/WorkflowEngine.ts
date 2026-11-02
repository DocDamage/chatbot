/**
 * Canonical Guided Workflow Engine (CRK-P04-T05)
 *
 * Executes guided workflow steps with complete support for:
 * - Escape Hatch (§1180-1190): Cancellation, goal mutation, or falling back to normal chat.
 * - Non-interference: Normal chat completely bypasses the engine (§1206).
 * - Resumability: Resumes execution from persisted state in WorkflowStateRepository.
 */

import {
  WorkflowDefinition,
  WorkflowExecutionState,
  WorkflowStepDefinition,
} from '../../types/workflow';
import { WorkflowStateRepository } from './WorkflowStateRepository';

export interface WorkflowEngineConfig {
  repository?: WorkflowStateRepository;
}

export interface WorkflowStepResult {
  state: WorkflowExecutionState;
  completed: boolean;
  requiresInput?: boolean;
  requiresApproval?: boolean;
  message?: string;
}

export class WorkflowEngine {
  private readonly repository: WorkflowStateRepository;

  constructor(config: WorkflowEngineConfig = {}) {
    this.repository = config.repository || new WorkflowStateRepository();
  }

  public isEscapeHatch(message: string): { isEscape: boolean; reason?: string } {
    const text = message.trim().toLowerCase();
    if (
      text === 'cancel' ||
      text === 'abort' ||
      text === 'stop' ||
      text === 'exit' ||
      text === 'exit workflow' ||
      text === 'nevermind' ||
      text.startsWith('cancel workflow') ||
      text === 'switch to normal chat' ||
      text === 'stop workflow'
    ) {
      return { isEscape: true, reason: 'Explicit user cancellation' };
    }
    if (text.startsWith('instead ') || text.startsWith('actually, let') || text.startsWith('change goal to')) {
      return { isEscape: true, reason: 'Goal mutation escape hatch' };
    }
    return { isEscape: false };
  }

  public async startWorkflow(
    sessionId: string,
    workflow: WorkflowDefinition,
    initialInputs: Record<string, unknown> = {}
  ): Promise<WorkflowExecutionState> {
    const now = new Date().toISOString();
    const state: WorkflowExecutionState = {
      sessionId,
      workflowId: workflow.id,
      version: workflow.version,
      activeStepId: workflow.startStep,
      status: 'running',
      stepOutputs: { ...initialInputs },
      approvals: {},
      failures: [],
      cancelled: false,
      startedAt: now,
      updatedAt: now,
    };

    await this.repository.saveState(state);
    return state;
  }

  public async step(
    sessionId: string,
    workflow: WorkflowDefinition,
    userInput?: string
  ): Promise<WorkflowStepResult> {
    const state = await this.repository.getState(sessionId);
    if (!state) {
      throw new Error(`[WorkflowEngine] No active workflow for session: ${sessionId}`);
    }

    // Check escape hatch on incoming user input
    if (userInput) {
      const escape = this.isEscapeHatch(userInput);
      if (escape.isEscape) {
        state.status = 'cancelled';
        state.cancelled = true;
        state.cancelReason = escape.reason;
        state.updatedAt = new Date().toISOString();
        await this.repository.saveState(state);
        return {
          state,
          completed: true,
          message: `Workflow cancelled: ${escape.reason}. Returning to free-form chat.`,
        };
      }
    }

    const currentStepDef: WorkflowStepDefinition | undefined = workflow.steps[state.activeStepId];
    if (!currentStepDef) {
      state.status = 'failed';
      state.updatedAt = new Date().toISOString();
      await this.repository.saveState(state);
      throw new Error(`[WorkflowEngine] Unknown step id: ${state.activeStepId}`);
    }

    // Handle step execution based on type
    if (currentStepDef.type === 'end') {
      state.status = 'completed';
      state.updatedAt = new Date().toISOString();
      await this.repository.saveState(state);
      return { state, completed: true, message: 'Workflow completed successfully.' };
    }

    if (currentStepDef.type === 'approval') {
      // Check if approval was already granted in state
      const existingApproval = state.approvals[currentStepDef.id];
      if (!existingApproval || !existingApproval.approved) {
        state.status = 'waiting_approval';
        state.updatedAt = new Date().toISOString();
        await this.repository.saveState(state);
        return {
          state,
          completed: false,
          requiresApproval: true,
          message: `Step '${currentStepDef.name}' requires authorization before proceeding.`,
        };
      }
    }

    // Advance to next step
    let nextStepId = currentStepDef.nextStepId;

    // Check transitions
    if (currentStepDef.transitions && currentStepDef.transitions.length > 0) {
      for (const t of currentStepDef.transitions) {
        // Simple condition evaluation
        if (t.condition.includes('retryCount') && state.failures.length > 0 && state.failures.length <= 2) {
          nextStepId = t.targetStepId;
          break;
        }
      }
    }

    if (!nextStepId) {
      state.status = 'completed';
      state.updatedAt = new Date().toISOString();
      await this.repository.saveState(state);
      return { state, completed: true };
    }

    state.activeStepId = nextStepId;
    state.status = 'running';
    state.updatedAt = new Date().toISOString();
    await this.repository.saveState(state);

    return {
      state,
      completed: false,
      message: `Advanced to step: ${nextStepId}`,
    };
  }

  public getRepository(): WorkflowStateRepository {
    return this.repository;
  }
}
