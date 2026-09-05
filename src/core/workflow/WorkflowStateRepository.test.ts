import { WorkflowStateRepository } from './WorkflowStateRepository';
import { WorkflowExecutionState } from '../../types/workflow';

describe('WorkflowStateRepository (CRK-P04-T02)', () => {
  let repo: WorkflowStateRepository;

  beforeEach(() => {
    repo = new WorkflowStateRepository();
  });

  const makeState = (sessionId = 'sess-wf-1'): WorkflowExecutionState => ({
    sessionId,
    workflowId: 'wf-coding-v1',
    version: 1,
    activeStepId: 'step-understand-goal',
    status: 'running',
    stepOutputs: {},
    approvals: {},
    failures: [],
    cancelled: false,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('persists and retrieves workflow execution state', async () => {
    const state = makeState();
    await repo.saveState(state);

    const retrieved = await repo.getState('sess-wf-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.workflowId).toBe('wf-coding-v1');
    expect(retrieved?.activeStepId).toBe('step-understand-goal');
  });

  it('updates active step and attaches step output', async () => {
    const state = makeState();
    await repo.saveState(state);

    const updated = await repo.updateActiveStep('sess-wf-1', 'step-inspect-project', {
      key: 'detectedStack',
      value: { language: 'TypeScript', framework: 'React' },
    });

    expect(updated?.activeStepId).toBe('step-inspect-project');
    expect(updated?.stepOutputs.detectedStack).toEqual({ language: 'TypeScript', framework: 'React' });
  });

  it('marks workflow cancelled on escape hatch trigger', async () => {
    const state = makeState();
    await repo.saveState(state);

    const cancelled = await repo.markCancelled('sess-wf-1', 'User changed goal');
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelled).toBe(true);
    expect(cancelled?.cancelReason).toBe('User changed goal');
  });

  it('records failure and transitions status to failed', async () => {
    const state = makeState();
    await repo.saveState(state);

    await repo.recordFailure('sess-wf-1', 'step-inspect-project', 'File not found');
    const retrieved = await repo.getState('sess-wf-1');
    expect(retrieved?.status).toBe('failed');
    expect(retrieved?.failures.length).toBe(1);
    expect(retrieved?.failures[0].error).toBe('File not found');
  });
});
