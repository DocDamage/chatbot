/**
 * Auto Drive
 * Self-healing multi-step task automation with recovery
 * Inspired by just-every/code's Auto Drive feature
 */

import { logger } from '../observability/logger';
import { MultiAgentOrchestrator, ConsensusResult } from './MultiAgentOrchestrator';
import { ReasoningController, ReasoningLevel } from './ReasoningController';

export interface Task {
    id: string;
    description: string;
    status: TaskStatus;
    subtasks: SubTask[];
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    result?: TaskResult;
    error?: string;
    retryCount: number;
}

export interface SubTask {
    id: string;
    description: string;
    status: TaskStatus;
    dependencies: string[];
    result?: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
}

export type TaskStatus =
    | 'pending'
    | 'planning'
    | 'in_progress'
    | 'waiting_approval'
    | 'recovering'
    | 'completed'
    | 'failed';

export interface TaskResult {
    success: boolean;
    output: string;
    artifacts?: string[];
    metrics: {
        totalTime: number;
        subtasksCompleted: number;
        subtasksFailed: number;
        retries: number;
    };
}

export interface AutoDriveConfig {
    maxRetries: number;
    retryDelayMs: number;
    maxSubtasks: number;
    requireApproval: boolean;
    reasoningLevel: ReasoningLevel;
    timeout: number;
}

export class AutoDrive {
    private orchestrator: MultiAgentOrchestrator;
    private reasoningController: ReasoningController;
    private activeTasks: Map<string, Task> = new Map();
    private config: AutoDriveConfig;

    constructor(
        orchestrator: MultiAgentOrchestrator,
        reasoningController: ReasoningController,
        config?: Partial<AutoDriveConfig>
    ) {
        this.orchestrator = orchestrator;
        this.reasoningController = reasoningController;
        this.config = {
            maxRetries: 3,
            retryDelayMs: 1000,
            maxSubtasks: 10,
            requireApproval: false,
            reasoningLevel: 'medium',
            timeout: 300000, // 5 minutes
            ...config
        };
    }

    /**
     * Start a new automated task
     */
    async start(description: string): Promise<Task> {
        const taskId = this.generateId();

        const task: Task = {
            id: taskId,
            description,
            status: 'planning',
            subtasks: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            retryCount: 0
        };

        this.activeTasks.set(taskId, task);
        logger.info('Auto Drive started', { taskId, description });

        try {
            // Phase 1: Decompose into subtasks
            await this.planTask(task);

            // Phase 2: Execute subtasks
            await this.executeTask(task);

            // Phase 3: Compile results
            task.result = this.compileResults(task);
            task.status = task.result.success ? 'completed' : 'failed';
            task.completedAt = new Date();

        } catch (error: any) {
            task.status = 'failed';
            task.error = error.message;
            logger.error('Auto Drive failed', { taskId, error: error.message });
        }

        task.updatedAt = new Date();
        return task;
    }

    /**
     * Get task status
     */
    getStatus(taskId: string): Task | undefined {
        return this.activeTasks.get(taskId);
    }

    /**
     * Get all active tasks
     */
    getActiveTasks(): Task[] {
        return Array.from(this.activeTasks.values())
            .filter(t => t.status !== 'completed' && t.status !== 'failed');
    }

    /**
     * Resume a paused or failed task
     */
    async resume(taskId: string): Promise<Task | undefined> {
        const task = this.activeTasks.get(taskId);
        if (!task) return undefined;

        if (task.status === 'failed' && task.retryCount < this.config.maxRetries) {
            task.retryCount++;
            task.status = 'recovering';
            logger.info('Resuming failed task', { taskId, retry: task.retryCount });

            try {
                await this.executeTask(task);
                task.result = this.compileResults(task);
                task.status = task.result.success ? 'completed' : 'failed';
            } catch (error: any) {
                task.status = 'failed';
                task.error = error.message;
            }
        }

        return task;
    }

    /**
     * Cancel a running task
     */
    cancel(taskId: string): boolean {
        const task = this.activeTasks.get(taskId);
        if (!task) return false;

        task.status = 'failed';
        task.error = 'Cancelled by user';
        task.updatedAt = new Date();

        logger.info('Task cancelled', { taskId });
        return true;
    }

    /**
     * Phase 1: Plan and decompose task into subtasks
     */
    private async planTask(task: Task): Promise<void> {
        const planningPrompt = this.reasoningController.buildReasoningPrompt(
            `Break down this task into subtasks (max ${this.config.maxSubtasks}):

Task: ${task.description}

Return a JSON array of subtasks with this format:
[
  { "id": "1", "description": "First subtask", "dependencies": [] },
  { "id": "2", "description": "Second subtask", "dependencies": ["1"] }
]

Each subtask should be:
- Atomic (one clear action)
- Testable (can verify completion)
- Dependent (list which subtasks must complete first)`,
            this.config.reasoningLevel
        );

        const response = await this.orchestrator.execute(
            planningPrompt,
            { mode: 'consensus', timeout: 60000 }
        );

        const content = this.extractContent(response);
        const subtasks = this.parseSubtasks(content);

        task.subtasks = subtasks.slice(0, this.config.maxSubtasks);
        task.status = 'in_progress';
        task.updatedAt = new Date();

        logger.info('Task planned', {
            taskId: task.id,
            subtaskCount: task.subtasks.length
        });
    }

    /**
     * Phase 2: Execute subtasks in dependency order
     */
    private async executeTask(task: Task): Promise<void> {
        const pendingSubtasks = task.subtasks.filter(st =>
            st.status !== 'completed'
        );

        for (const subtask of this.getExecutionOrder(pendingSubtasks)) {
            // Check if dependencies are met
            const depsMet = this.checkDependencies(subtask, task.subtasks);
            if (!depsMet) {
                subtask.status = 'failed';
                subtask.error = 'Dependencies not met';
                continue;
            }

            // Execute subtask
            subtask.status = 'in_progress';
            subtask.startedAt = new Date();

            try {
                const result = await this.executeSubtask(subtask, task);
                subtask.result = result;
                subtask.status = 'completed';
                subtask.completedAt = new Date();

                logger.info('Subtask completed', {
                    taskId: task.id,
                    subtaskId: subtask.id
                });

            } catch (error: any) {
                subtask.status = 'failed';
                subtask.error = error.message;

                logger.warn('Subtask failed', {
                    taskId: task.id,
                    subtaskId: subtask.id,
                    error: error.message
                });

                // Attempt recovery
                const recovered = await this.attemptRecovery(subtask, task);
                if (!recovered && this.isBlockingFailure(subtask, task.subtasks)) {
                    throw new Error(`Blocking subtask failed: ${subtask.description}`);
                }
            }

            task.updatedAt = new Date();
        }
    }

    /**
     * Execute a single subtask
     */
    private async executeSubtask(subtask: SubTask, task: Task): Promise<string> {
        const context = this.buildContext(subtask, task);

        const prompt = this.reasoningController.buildReasoningPrompt(
            `Complete this subtask:

Context: ${context}

Subtask: ${subtask.description}

Provide a clear result or output.`,
            this.config.reasoningLevel
        );

        const response = await this.orchestrator.execute(
            prompt,
            { mode: 'race', timeout: this.config.timeout / this.config.maxSubtasks }
        );

        return this.extractContent(response);
    }

    /**
     * Attempt to recover from a failed subtask
     */
    private async attemptRecovery(subtask: SubTask, task: Task): Promise<boolean> {
        if (subtask.error?.includes('Cancelled')) return false;

        const recoveryPrompt = `A subtask failed. Analyze and suggest a fix:

Task: ${task.description}
Failed Subtask: ${subtask.description}
Error: ${subtask.error}

Previously completed:
${task.subtasks
                .filter(st => st.status === 'completed')
                .map(st => `- ${st.description}: ${st.result?.substring(0, 100)}...`)
                .join('\n')}

Suggest an alternative approach or fix.`;

        try {
            const response = await this.orchestrator.execute(
                recoveryPrompt,
                { mode: 'consensus', timeout: 30000 }
            );

            const recovery = this.extractContent(response);

            // Re-execute with recovery suggestion
            subtask.description = `[RECOVERY] ${subtask.description}\nApproach: ${recovery.substring(0, 200)}`;
            subtask.status = 'pending';

            const result = await this.executeSubtask(subtask, task);
            subtask.result = result;
            subtask.status = 'completed';
            subtask.completedAt = new Date();

            logger.info('Subtask recovered', { subtaskId: subtask.id });
            return true;

        } catch {
            return false;
        }
    }

    /**
     * Build context from completed subtasks
     */
    private buildContext(subtask: SubTask, task: Task): string {
        const completed = task.subtasks
            .filter(st => st.status === 'completed')
            .map(st => `${st.description}: ${st.result?.substring(0, 200)}`)
            .join('\n');

        return `Main Task: ${task.description}
Completed so far:
${completed || 'None'}

Dependencies for current subtask:
${subtask.dependencies.map(depId => {
            const dep = task.subtasks.find(st => st.id === depId);
            return dep ? `- ${dep.description}` : '';
        }).join('\n') || 'None'}`;
    }

    /**
     * Check if dependencies are met
     */
    private checkDependencies(subtask: SubTask, allSubtasks: SubTask[]): boolean {
        return subtask.dependencies.every(depId => {
            const dep = allSubtasks.find(st => st.id === depId);
            return dep?.status === 'completed';
        });
    }

    /**
     * Check if failure is blocking (other tasks depend on it)
     */
    private isBlockingFailure(failedSubtask: SubTask, allSubtasks: SubTask[]): boolean {
        return allSubtasks.some(st =>
            st.dependencies.includes(failedSubtask.id) &&
            st.status !== 'completed' &&
            st.status !== 'failed'
        );
    }

    /**
     * Get subtasks in execution order (topological sort)
     */
    private getExecutionOrder(subtasks: SubTask[]): SubTask[] {
        const sorted: SubTask[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (subtask: SubTask): void => {
            if (visited.has(subtask.id)) return;
            if (visiting.has(subtask.id)) {
                throw new Error(`Circular dependency detected: ${subtask.id}`);
            }

            visiting.add(subtask.id);

            for (const depId of subtask.dependencies) {
                const dep = subtasks.find(st => st.id === depId);
                if (dep) visit(dep);
            }

            visiting.delete(subtask.id);
            visited.add(subtask.id);
            sorted.push(subtask);
        };

        for (const subtask of subtasks) {
            visit(subtask);
        }

        return sorted;
    }

    /**
     * Compile results from all subtasks
     */
    private compileResults(task: Task): TaskResult {
        const completed = task.subtasks.filter(st => st.status === 'completed');
        const failed = task.subtasks.filter(st => st.status === 'failed');

        const output = completed
            .map(st => `## ${st.description}\n${st.result}`)
            .join('\n\n');

        return {
            success: failed.length === 0,
            output,
            metrics: {
                totalTime: task.completedAt
                    ? task.completedAt.getTime() - task.createdAt.getTime()
                    : Date.now() - task.createdAt.getTime(),
                subtasksCompleted: completed.length,
                subtasksFailed: failed.length,
                retries: task.retryCount
            }
        };
    }

    /**
     * Parse subtasks from AI response
     */
    private parseSubtasks(content: string): SubTask[] {
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return parsed.map((item: any) => ({
                id: String(item.id || this.generateId()),
                description: item.description || item.task || '',
                status: 'pending' as TaskStatus,
                dependencies: Array.isArray(item.dependencies)
                    ? item.dependencies.map(String)
                    : []
            }));

        } catch (error) {
            // Fallback: create single subtask from content
            return [{
                id: '1',
                description: content.substring(0, 500),
                status: 'pending',
                dependencies: []
            }];
        }
    }

    /**
     * Extract content from orchestrator response
     */
    private extractContent(response: any): string {
        if (typeof response === 'string') return response;
        if ('content' in response) return response.content;
        if ('finalAnswer' in response) return response.finalAnswer;
        return JSON.stringify(response);
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
