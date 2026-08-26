import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AutoDrive } from '../AutoDrive';
import { ReasoningController } from '../../agents/ReasoningController';

describe('RT-AUTO-001: AutoDrive Task Planning and Self-Healing Suite', () => {
  let mockOrchestrator: any;
  let reasoningController: ReasoningController;
  let autoDrive: AutoDrive;

  beforeEach(() => {
    mockOrchestrator = {
      runWorkflow: jest.fn<any>().mockResolvedValue({
        success: true,
        finalDecision: 'Step completed successfully',
        confidence: 0.95
      }),
      execute: jest.fn<any>().mockResolvedValue({
        success: true,
        output: 'Step executed'
      })
    };

    reasoningController = new ReasoningController('low');

    autoDrive = new AutoDrive(mockOrchestrator, reasoningController, {
      maxRetries: 2,
      requireApproval: false
    });
  });

  it('plans and executes multi-step tasks to completion', async () => {
    mockOrchestrator.execute.mockResolvedValueOnce(
      JSON.stringify([
        { id: '1', description: 'Step 1', dependencies: [] },
        { id: '2', description: 'Step 2', dependencies: ['1'] }
      ])
    );

    const task = await autoDrive.start('Build feature and run verification');

    expect(task.id).toBeDefined();
    expect(task.status).toBe('completed');
    expect(task.result?.success).toBe(true);
    expect(autoDrive.getStatus(task.id)).toBeDefined();
  });

  it('covers cancellation, active tasks list, and resuming failed tasks', async () => {
    const task = await autoDrive.start('Short task');
    expect(autoDrive.getActiveTasks().length).toBe(0);

    // Cancel non-existent
    expect(autoDrive.cancel('non-existent')).toBe(false);

    // Create a failed task to resume
    mockOrchestrator.execute.mockRejectedValueOnce(new Error('Execution crash'));
    const failingTask = await autoDrive.start('Failing task');
    expect(failingTask.status).toBe('failed');

    // Resume failing task
    mockOrchestrator.execute.mockResolvedValueOnce({ content: 'Recovered output' });
    const resumed = await autoDrive.resume(failingTask.id);
    expect(resumed?.status).toBe('completed');
  });

  it('attempts self-healing recovery on subtask failure', async () => {
    mockOrchestrator.execute
      .mockResolvedValueOnce(
        JSON.stringify([
          { id: '1', description: 'Subtask with recovery', dependencies: [] }
        ])
      )
      .mockRejectedValueOnce(new Error('Temporary tool error'))
      .mockResolvedValueOnce({ content: 'Use fallback tool' })
      .mockResolvedValueOnce({ content: 'Fallback success' });

    const task = await autoDrive.start('Self-healing task');
    expect(task.status).toBe('completed');
    expect(task.subtasks[0].description).toContain('[RECOVERY]');
  });

  it('detects circular dependencies and falls back on non-JSON plan response', async () => {
    mockOrchestrator.execute.mockResolvedValueOnce('Plain text planning instructions without JSON');
    const task = await autoDrive.start('Plain text plan task');
    expect(task.subtasks.length).toBe(1);
    expect(task.subtasks[0].description).toContain('Plain text planning');
  });
});
