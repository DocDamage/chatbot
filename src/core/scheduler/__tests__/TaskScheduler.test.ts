import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { TaskScheduler } from '../TaskScheduler';

describe('RT-SCHED-001: TaskScheduler Cron Automation Suite', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
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
});
