/**
 * Agent Team Coordinator & Task Graph Scheduler (CF-05)
 * Orchestrates parallel and sequential typed agent teams, task DAG execution,
 * worktree sandboxing, failure propagation, stop-all cancellation,
 * and review bundle assembly.
 */

import { logger } from '../../observability/logger';
import { AgentTeamRole, assertRoleAuthority } from './AgentTeamRoles';
import { TaskEnvelope, TaskResult, verifyTaskEnvelope } from './TaskEnvelope';
import { WorktreeLifecycleService } from './WorktreeLifecycleService';
import {
  assembleReviewerBundle,
  PatchCandidate,
  ReviewerBundle,
  ReviewSignoff,
  VerificationEvidenceItem
} from './ReviewerBundle';

export class TeamCoordinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamCoordinationError';
  }
}

export class DependencyFailedError extends Error {
  constructor(public readonly failedDependencyId: string) {
    super(`Prerequisite dependency '${failedDependencyId}' failed`);
    this.name = 'DependencyFailedError';
  }
}

export type TeamWorkerFunction = (
  envelope: TaskEnvelope,
  worktreeService: WorktreeLifecycleService,
  signal: AbortSignal
) => Promise<TaskResult>;

export interface TeamPlan {
  teamId?: string;
  tasks: TaskEnvelope[];
  maxConcurrency?: number;
  totalTokenBudget?: number;
  totalTimeBudgetMs?: number;
  enableSingleAgentFallback?: boolean;
}

export interface TeamExecutionReport {
  teamId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  tasks: TaskEnvelope[];
  completedTaskIds: string[];
  failedTaskIds: string[];
  cancelledTaskIds: string[];
  tokensUsed: number;
  durationMs: number;
  partialResults: Record<string, TaskResult>;
  bundle?: ReviewerBundle;
  error?: string;
}

export class AgentTeamCoordinator {
  private workers = new Map<AgentTeamRole, TeamWorkerFunction>();
  private worktreeService: WorktreeLifecycleService;
  private activeControllers = new Map<string, AbortController>();
  private globalAbortController: AbortController | null = null;

  constructor(options: { worktreeService?: WorktreeLifecycleService } = {}) {
    this.worktreeService = options.worktreeService || new WorktreeLifecycleService();
  }

  /**
   * Register worker implementation for a given role
   */
  registerWorker(role: AgentTeamRole, worker: TeamWorkerFunction): void {
    this.workers.set(role, worker);
    logger.info(`Registered worker for role: ${role}`);
  }

  /**
   * Execute team plan across task graph
   */
  async executePlan(plan: TeamPlan): Promise<TeamExecutionReport> {
    const teamId = plan.teamId || `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();
    this.globalAbortController = new AbortController();
    const globalSignal = this.globalAbortController.signal;

    const maxConcurrency = plan.maxConcurrency ?? 4;
    const totalTokenBudget = plan.totalTokenBudget ?? 500000;
    const totalTimeBudgetMs = plan.totalTimeBudgetMs ?? 300000;

    if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
      throw new TeamCoordinationError('maxConcurrency must be a positive integer');
    }
    if (totalTokenBudget < 1 || totalTimeBudgetMs < 1) {
      throw new TeamCoordinationError('Team token and time budgets must be positive');
    }

    let tokensUsed = 0;
    const tasks = [...plan.tasks];
    const taskMap = new Map<string, TaskEnvelope>(tasks.map(t => [t.taskId, t]));
    const results = new Map<string, TaskResult>();
    const completed = new Set<string>();
    const failed = new Set<string>();
    const cancelled = new Set<string>();

    // Validate DAG for cycles
    this.validateDag(tasks);

    // Validate all envelopes
    for (const task of tasks) {
      if (!verifyTaskEnvelope(task)) {
        throw new TeamCoordinationError(`TaskEnvelope integrity verification failed for ${task.taskId}`);
      }
    }

    // Set overall timeout
    const timeoutTimer = setTimeout(() => {
      this.stopAll(`Global team timeout exceeded (${totalTimeBudgetMs}ms)`);
    }, totalTimeBudgetMs);

    try {
      const runningPromises = new Map<string, Promise<void>>();

      while (completed.size + failed.size + cancelled.size < tasks.length) {
        if (globalSignal.aborted) {
          // Mark all remaining pending tasks as cancelled
          for (const task of tasks) {
            if (task.status === 'pending') {
              task.status = 'cancelled';
              task.error = 'Execution cancelled by stop-all';
              cancelled.add(task.taskId);
            }
          }
          break;
        }

        // Find ready tasks
        const readyTasks = tasks.filter(task => {
          if (task.status !== 'pending') return false;
          // Check if any dependency failed
          const depFailed = task.dependencies.some(depId => failed.has(depId) || cancelled.has(depId));
          if (depFailed) {
            task.status = 'failed';
            task.error = 'Dependency failed';
            failed.add(task.taskId);
            return false;
          }
          // Check if all dependencies completed
          return task.dependencies.every(depId => completed.has(depId));
        });

        // Launch ready tasks up to concurrency
        for (const task of readyTasks) {
          if (runningPromises.size >= maxConcurrency) break;

          task.status = 'in_progress';
          const taskController = new AbortController();
          this.activeControllers.set(task.taskId, taskController);
          const taskTimeout = setTimeout(() => taskController.abort(), task.budget.maxTimeMs ?? 120000);

          const promise = this.runTask(task, taskController.signal)
            .then(res => {
              results.set(task.taskId, res);
              tokensUsed += res.tokensUsed;
              const budgetErrors: string[] = [];
              if (res.tokensUsed > (task.budget.maxTokens ?? Number.MAX_SAFE_INTEGER)) {
                budgetErrors.push(`token budget exceeded (${res.tokensUsed}/${task.budget.maxTokens})`);
              }
              if (res.timeTakenMs > (task.budget.maxTimeMs ?? Number.MAX_SAFE_INTEGER)) {
                budgetErrors.push(`time budget exceeded (${res.timeTakenMs}/${task.budget.maxTimeMs}ms)`);
              }
              if (res.commandsRun > (task.budget.maxCommands ?? Number.MAX_SAFE_INTEGER)) {
                budgetErrors.push(`command budget exceeded (${res.commandsRun}/${task.budget.maxCommands})`);
              }

              if (res.success && budgetErrors.length === 0) {
                task.status = 'completed';
                task.result = res;
                completed.add(task.taskId);
              } else {
                task.status = 'failed';
                task.error = budgetErrors.join('; ') || res.error || 'Worker returned failure';
                failed.add(task.taskId);
              }
            })
            .catch(err => {
              task.status = globalSignal.aborted ? 'cancelled' : 'failed';
              task.error = err.message;
              if (globalSignal.aborted) {
                cancelled.add(task.taskId);
              } else {
                failed.add(task.taskId);
              }
            })
            .finally(() => {
              clearTimeout(taskTimeout);
              this.activeControllers.delete(task.taskId);
              runningPromises.delete(task.taskId);
            });

          runningPromises.set(task.taskId, promise);
        }

        if (runningPromises.size > 0) {
          // Wait for at least one running task to finish
          await Promise.race(Array.from(runningPromises.values()));
        } else if (readyTasks.length === 0 && completed.size + failed.size + cancelled.size < tasks.length) {
          // No tasks ready and none running -> deadlock or all blocked by failed deps
          for (const task of tasks) {
            if (task.status === 'pending') {
              task.status = 'failed';
              task.error = 'Blocked by failed or unresolved dependencies';
              failed.add(task.taskId);
            }
          }
          break;
        }

        // Check token budget limit
        if (tokensUsed > totalTokenBudget) {
          this.stopAll(`Total team token budget exceeded (${tokensUsed}/${totalTokenBudget})`);
        }
      }

      // Collect patches from completed mutation workers
      const patches: PatchCandidate[] = [];
      for (const [taskId, res] of results.entries()) {
        const task = taskMap.get(taskId);
        if (task && (task.role === 'implementer' || task.role === 'test_author') && res.success) {
          const mutations = this.worktreeService.getMutations(taskId);
          if (mutations.length > 0) {
            patches.push({
              taskId,
              workerId: res.workerId,
              mutations
            });
          }
        }
      }

      // Assemble bundle
      const bundle = assembleReviewerBundle({
        envelopes: tasks,
        patches
      });

      const durationMs = Date.now() - startTime;
      const isComplete = failed.size === 0 && cancelled.size === 0;

      return {
        teamId,
        status: isComplete ? 'completed' : cancelled.size > 0 ? 'cancelled' : completed.size > 0 ? 'partial' : 'failed',
        tasks,
        completedTaskIds: Array.from(completed),
        failedTaskIds: Array.from(failed),
        cancelledTaskIds: Array.from(cancelled),
        tokensUsed,
        durationMs,
        partialResults: Object.fromEntries(results.entries()),
        bundle,
        error: isComplete ? undefined : `${failed.size} tasks failed, ${cancelled.size} cancelled`
      };
    } finally {
      clearTimeout(timeoutTimer);
      this.worktreeService.cleanupAll();
    }
  }

  /**
   * Execute team plan in single-agent fallback mode (strictly sequential single-worker execution)
   */
  async executeSingleAgentFallback(plan: TeamPlan): Promise<TeamExecutionReport> {
    logger.info('Executing team plan in single-agent fallback mode', { teamId: plan.teamId });
    return this.executePlan({
      ...plan,
      maxConcurrency: 1,
      enableSingleAgentFallback: true
    });
  }

  private async runTask(envelope: TaskEnvelope, taskSignal: AbortSignal): Promise<TaskResult> {
    assertRoleAuthority(envelope.role, envelope.authority.allowedActions[0] || 'read_file');

    const worker = this.workers.get(envelope.role) || this.defaultWorker(envelope.role);
    const workerId = `w-${envelope.role}-${Math.random().toString(36).slice(2, 6)}`;
    envelope.assignedWorkerId = workerId;

    if (envelope.role === 'implementer' || envelope.role === 'test_author') {
      await this.worktreeService.createWorktree(envelope, workerId);
    }

    if (taskSignal.aborted) {
      const error = new Error('Task aborted before worker execution');
      error.name = 'AbortError';
      throw error;
    }

    const workerPromise = worker(envelope, this.worktreeService, taskSignal);
    const abortPromise = new Promise<never>((_resolve, reject) => {
      taskSignal.addEventListener('abort', () => {
        const error = new Error(`Task '${envelope.taskId}' cancelled or exceeded its time budget`);
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });

    return Promise.race([workerPromise, abortPromise]);
  }

  /**
   * Stop all running tasks immediately and cancel remaining queue
   */
  stopAll(reason: string = 'User initiated stop-all'): void {
    logger.warn('Stopping all active agent team workers', { reason });
    if (this.globalAbortController) {
      this.globalAbortController.abort();
    }
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    this.worktreeService.cleanupAll();
  }

  /**
   * Cancel a specific running task
   */
  cancelTask(taskId: string, reason: string = 'Task cancelled'): void {
    const controller = this.activeControllers.get(taskId);
    if (controller) {
      controller.abort();
      logger.info('Cancelled task', { taskId, reason });
    }
  }

  private validateDag(tasks: TaskEnvelope[]): void {
    const taskIds = new Set(tasks.map(t => t.taskId));
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (curr: string) => {
      visited.add(curr);
      recStack.add(curr);

      const task = tasks.find(t => t.taskId === curr);
      if (task) {
        for (const dep of task.dependencies) {
          if (!taskIds.has(dep)) {
            throw new TeamCoordinationError(`Task ${curr} references non-existent dependency ${dep}`);
          }
          if (!visited.has(dep) && checkCycle(dep)) {
            return true;
          } else if (recStack.has(dep)) {
            throw new TeamCoordinationError(`Cyclic dependency detected involving task ${curr} and ${dep}`);
          }
        }
      }

      recStack.delete(curr);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.taskId)) {
        checkCycle(task.taskId);
      }
    }
  }

  private defaultWorker(role: AgentTeamRole): TeamWorkerFunction {
    return async (envelope, worktree, signal) => {
      if (signal.aborted) {
        const err = new Error('Task aborted');
        err.name = 'AbortError';
        throw err;
      }

      const start = Date.now();
      return {
        taskId: envelope.taskId,
        workerId: `default-${role}`,
        success: true,
        outputs: { message: `Completed ${envelope.title} via default ${role} handler` },
        tokensUsed: 100,
        timeTakenMs: Date.now() - start,
        commandsRun: 0,
        completedAt: new Date().toISOString()
      };
    };
  }
}
