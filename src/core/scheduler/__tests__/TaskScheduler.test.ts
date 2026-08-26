import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { TaskScheduler } from '../TaskScheduler';

describe('RT-SCHED-001: TaskScheduler Cron Automation Suite', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('schedules tasks, runs on-demand, and captures execution metrics', async () => {
    const mockAction = jest.fn<any>().mockResolvedValue(undefined);

    const taskId = await scheduler.addTask({
      name: 'Daily cleanup',
      cron: '0 0 * * *',
      action: mockAction,
      description: 'Clean temp files',
      timeout: 5000
    });

    expect(taskId).toBeDefined();
    const task = scheduler.getTask(taskId);
    expect(task?.name).toBe('Daily cleanup');
    expect(task?.enabled).toBe(true);
    expect((scheduler as any).cronJobs.get(taskId).getStatus()).toBe('stopped');

    const result = await scheduler.executeTask(taskId);
    expect(result.success).toBe(true);
    expect(mockAction).toHaveBeenCalledTimes(1);

    const stats = scheduler.getStats();
    expect(stats.totalTasks).toBe(1);
    expect(stats.totalExecutions).toBe(1);
  });

  it('enables, disables, and removes tasks', async () => {
    const mockAction = jest.fn<any>().mockResolvedValue(undefined);

    const taskId = await scheduler.addTask({
      name: 'Heartbeat',
      cron: '*/5 * * * *',
      action: mockAction
    });

    scheduler.disableTask(taskId);
    expect(scheduler.getTask(taskId)?.enabled).toBe(false);

    scheduler.enableTask(taskId);
    expect(scheduler.getTask(taskId)?.enabled).toBe(true);

    const removed = scheduler.removeTask(taskId);
    expect(removed).toBe(true);
    expect(scheduler.getTasks()).toHaveLength(0);
  });

  it('rejects invalid cron expressions and handles missing or disabled task execution', async () => {
    await expect(scheduler.addTask({
      name: 'Invalid cron task',
      cron: 'invalid cron string',
      action: async () => {}
    })).rejects.toThrow('Invalid cron expression');

    // Missing task execution
    const missingRes = await scheduler.executeTask('non-existent-task-id');
    expect(missingRes.success).toBe(false);
    expect(missingRes.error).toBe('Task not found');

    // Disabled task execution
    const taskId = await scheduler.addTask({
      name: 'Disabled task',
      cron: '0 * * * *',
      action: async () => {}
    });
    scheduler.disableTask(taskId);
    const disabledRes = await scheduler.executeTask(taskId);
    expect(disabledRes.success).toBe(false);
    expect(disabledRes.error).toBe('Task is disabled');
  });

  it('evaluates task conditions and executes retries on failure', async () => {
    // Failing condition
    const condTaskId = await scheduler.addTask({
      name: 'Condition task',
      cron: '0 * * * *',
      action: async () => {},
      conditions: [{ type: 'custom', check: () => false }]
    });

    const condRes = await scheduler.executeTask(condTaskId);
    expect(condRes.success).toBe(false);
    expect(condRes.error).toBe('Conditions not met');

    // Failing action with retries
    let attemptCount = 0;
    const retryTaskId = await scheduler.addTask({
      name: 'Retry task',
      cron: '0 * * * *',
      retries: 2,
      action: async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Transient error');
        }
      }
    });

    const retryRes = await scheduler.executeTask(retryTaskId);
    expect(retryRes.success).toBe(true);
    expect(attemptCount).toBe(2);

    // Completely failing task
    const failTaskId = await scheduler.addTask({
      name: 'Fail task',
      cron: '0 * * * *',
      retries: 1,
      action: async () => {
        throw new Error('Persistent fatal failure');
      }
    });

    const failRes = await scheduler.executeTask(failTaskId);
    expect(failRes.success).toBe(false);
    expect(failRes.error).toBe('Persistent fatal failure');

    // History and helper conditions
    const history = scheduler.getHistory(10);
    expect(history.length).toBeGreaterThanOrEqual(2);

    // Lifecycle start and stop
    scheduler.start();
    scheduler.stop();
  });
});
