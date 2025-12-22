/**
 * Task Scheduler - Cron-based automation for scheduled tasks
 * Reference: hacker-scripts automation patterns
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger';

// Dynamic import for node-cron
let cron: any = null;
let cronLoaded = false;

async function loadCron(): Promise<boolean> {
    if (cron !== null) return cronLoaded;

    try {
        cron = require('node-cron');
        cronLoaded = true;
        logger.info('node-cron loaded successfully');
        return true;
    } catch (error) {
        logger.warn('node-cron not available - scheduling will be limited');
        cronLoaded = false;
        return false;
    }
}

export interface ScheduledTask {
    id: string;
    name: string;
    description?: string;
    cron: string;
    action: () => Promise<void>;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    runCount: number;
    errorCount: number;
    lastError?: string;
    timeout: number; // ms
    retries: number;
    conditions?: TaskCondition[];
}

export interface TaskCondition {
    type: 'time_range' | 'weekday' | 'custom';
    check: () => boolean;
}

export interface TaskExecutionResult {
    taskId: string;
    success: boolean;
    duration: number;
    error?: string;
    timestamp: Date;
}

export class TaskScheduler {
    private tasks: Map<string, ScheduledTask> = new Map();
    private cronJobs: Map<string, any> = new Map();
    private history: TaskExecutionResult[] = [];
    private maxHistorySize: number = 1000;
    private isRunning: boolean = false;

    constructor() {
        logger.info('TaskScheduler initialized');
    }

    /**
     * Add a scheduled task
     */
    async addTask(options: {
        name: string;
        description?: string;
        cron: string;
        action: () => Promise<void>;
        timeout?: number;
        retries?: number;
        conditions?: TaskCondition[];
    }): Promise<string> {
        const isLoaded = await loadCron();

        if (!isLoaded) {
            throw new Error('Scheduling requires node-cron package');
        }

        // Validate cron expression
        if (!cron.validate(options.cron)) {
            throw new Error(`Invalid cron expression: ${options.cron}`);
        }

        const task: ScheduledTask = {
            id: uuidv4(),
            name: options.name,
            description: options.description,
            cron: options.cron,
            action: options.action,
            enabled: true,
            runCount: 0,
            errorCount: 0,
            timeout: options.timeout || 30000,
            retries: options.retries || 0,
            conditions: options.conditions
        };

        this.tasks.set(task.id, task);

        // Create cron job
        const job = cron.schedule(options.cron, async () => {
            await this.executeTask(task.id);
        }, {
            scheduled: this.isRunning
        });

        this.cronJobs.set(task.id, job);

        logger.info('Task scheduled', {
            taskId: task.id,
            name: task.name,
            cron: task.cron
        });

        return task.id;
    }

    /**
     * Remove a scheduled task
     */
    removeTask(taskId: string): boolean {
        const job = this.cronJobs.get(taskId);
        if (job) {
            job.stop();
            this.cronJobs.delete(taskId);
        }

        const removed = this.tasks.delete(taskId);

        if (removed) {
            logger.info('Task removed', { taskId });
        }

        return removed;
    }

    /**
     * Enable a task
     */
    enableTask(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (task) {
            task.enabled = true;
            const job = this.cronJobs.get(taskId);
            if (job && this.isRunning) {
                job.start();
            }
        }
    }

    /**
     * Disable a task
     */
    disableTask(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (task) {
            task.enabled = false;
            const job = this.cronJobs.get(taskId);
            if (job) {
                job.stop();
            }
        }
    }

    /**
     * Execute a task manually
     */
    async executeTask(taskId: string): Promise<TaskExecutionResult> {
        const task = this.tasks.get(taskId);

        if (!task) {
            return {
                taskId,
                success: false,
                duration: 0,
                error: 'Task not found',
                timestamp: new Date()
            };
        }

        if (!task.enabled) {
            return {
                taskId,
                success: false,
                duration: 0,
                error: 'Task is disabled',
                timestamp: new Date()
            };
        }

        // Check conditions
        if (task.conditions) {
            for (const condition of task.conditions) {
                if (!condition.check()) {
                    logger.debug('Task condition not met', { taskId, conditionType: condition.type });
                    return {
                        taskId,
                        success: false,
                        duration: 0,
                        error: 'Conditions not met',
                        timestamp: new Date()
                    };
                }
            }
        }

        const startTime = Date.now();
        let attempts = 0;
        let lastError: string | undefined;

        while (attempts <= task.retries) {
            try {
                // Execute with timeout
                await Promise.race([
                    task.action(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Task timeout')), task.timeout)
                    )
                ]);

                task.lastRun = new Date();
                task.runCount++;

                const result: TaskExecutionResult = {
                    taskId,
                    success: true,
                    duration: Date.now() - startTime,
                    timestamp: new Date()
                };

                this.addToHistory(result);

                logger.info('Task executed successfully', {
                    taskId,
                    name: task.name,
                    duration: result.duration
                });

                return result;
            } catch (error: any) {
                lastError = error.message;
                attempts++;

                if (attempts <= task.retries) {
                    logger.warn('Task execution failed, retrying', {
                        taskId,
                        attempt: attempts,
                        error: error.message
                    });
                    await this.delay(1000 * attempts); // Exponential backoff
                }
            }
        }

        // All retries failed
        task.errorCount++;
        task.lastError = lastError;

        const result: TaskExecutionResult = {
            taskId,
            success: false,
            duration: Date.now() - startTime,
            error: lastError,
            timestamp: new Date()
        };

        this.addToHistory(result);

        logger.error('Task execution failed', {
            taskId,
            name: task.name,
            error: lastError
        });

        return result;
    }

    /**
     * Start the scheduler
     */
    async start(): Promise<void> {
        await loadCron();

        this.isRunning = true;

        for (const [taskId, job] of this.cronJobs.entries()) {
            const task = this.tasks.get(taskId);
            if (task?.enabled) {
                job.start();
            }
        }

        logger.info('TaskScheduler started', { taskCount: this.tasks.size });
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        this.isRunning = false;

        for (const job of this.cronJobs.values()) {
            job.stop();
        }

        logger.info('TaskScheduler stopped');
    }

    /**
     * Get all tasks
     */
    getTasks(): ScheduledTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get a specific task
     */
    getTask(taskId: string): ScheduledTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Get execution history
     */
    getHistory(limit: number = 100): TaskExecutionResult[] {
        return this.history.slice(-limit);
    }

    /**
     * Get task statistics
     */
    getStats(): {
        totalTasks: number;
        enabledTasks: number;
        totalExecutions: number;
        successRate: number;
        averageDuration: number;
    } {
        const history = this.history;
        const successful = history.filter(h => h.success).length;
        const totalDuration = history.reduce((sum, h) => sum + h.duration, 0);

        return {
            totalTasks: this.tasks.size,
            enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
            totalExecutions: history.length,
            successRate: history.length > 0 ? successful / history.length : 0,
            averageDuration: history.length > 0 ? totalDuration / history.length : 0
        };
    }

    /**
     * Add result to history
     */
    private addToHistory(result: TaskExecutionResult): void {
        this.history.push(result);

        // Trim history if too large
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create common condition checkers
     */
    static conditions = {
        /**
         * Only run between certain hours
         */
        timeRange(startHour: number, endHour: number): TaskCondition {
            return {
                type: 'time_range',
                check: () => {
                    const hour = new Date().getHours();
                    return hour >= startHour && hour < endHour;
                }
            };
        },

        /**
         * Only run on specific weekdays (0 = Sunday, 6 = Saturday)
         */
        weekdays(days: number[]): TaskCondition {
            return {
                type: 'weekday',
                check: () => {
                    const day = new Date().getDay();
                    return days.includes(day);
                }
            };
        },

        /**
         * Only run on business days (Mon-Fri)
         */
        businessDays(): TaskCondition {
            return this.weekdays([1, 2, 3, 4, 5]);
        },

        /**
         * Only run on weekends
         */
        weekends(): TaskCondition {
            return this.weekdays([0, 6]);
        },

        /**
         * Custom condition
         */
        custom(check: () => boolean): TaskCondition {
            return {
                type: 'custom',
                check
            };
        }
    };
}

// Singleton instance
let instance: TaskScheduler | null = null;

export function getTaskScheduler(): TaskScheduler {
    if (!instance) {
        instance = new TaskScheduler();
    }
    return instance;
}

export default TaskScheduler;
