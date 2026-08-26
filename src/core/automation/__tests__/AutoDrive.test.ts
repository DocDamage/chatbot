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
    const task = await autoDrive.start('Build feature and run verification');

    expect(task.id).toBeDefined();
    expect(task.status).toBe('completed');
    expect(task.result?.success).toBe(true);
    expect(autoDrive.getStatus(task.id)).toBeDefined();
  });
});
