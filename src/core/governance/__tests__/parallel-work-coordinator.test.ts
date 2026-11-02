import { ParallelWorkCoordinator } from '../ParallelWorkCoordinator';
import { LaneTaskAllocation } from '../../../types/dependency-graph';

describe('ParallelWorkCoordinator (Section 40 Parallel Work Rules)', () => {
  let coordinator: ParallelWorkCoordinator;

  beforeEach(() => {
    coordinator = new ParallelWorkCoordinator();
  });

  it('allocates task successfully with valid branch naming and distinct files', () => {
    const alloc: LaneTaskAllocation = {
      taskId: 'TASK-RUNTIME-01',
      laneId: 'LANE_1_RUNTIME',
      branchName: 'lane/runtime/TASK-RUNTIME-01',
      targetFiles: ['src/core/prompt/PromptAssembler.ts'],
      assignedAt: new Date().toISOString(),
    };

    const result = coordinator.allocateTask(alloc);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(coordinator.getAllocationsByLane('LANE_1_RUNTIME')).toHaveLength(1);
  });

  it('rejects invalid branch naming conventions', () => {
    const alloc: LaneTaskAllocation = {
      taskId: 'TASK-RUNTIME-02',
      laneId: 'LANE_1_RUNTIME',
      branchName: 'feature/bad-name',
      targetFiles: ['src/core/prompt/ContextBudgetService.ts'],
      assignedAt: new Date().toISOString(),
    };

    const result = coordinator.allocateTask(alloc);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('convention'))).toBe(true);
  });

  it('detects concurrent file edit conflicts between lanes', () => {
    const alloc1: LaneTaskAllocation = {
      taskId: 'TASK-RUNTIME-01',
      laneId: 'LANE_1_RUNTIME',
      branchName: 'lane/runtime/TASK-RUNTIME-01',
      targetFiles: ['src/core/chat/ChatRuntime.ts'],
      assignedAt: new Date().toISOString(),
    };
    coordinator.allocateTask(alloc1);

    const alloc2: LaneTaskAllocation = {
      taskId: 'TASK-CLIENT-01',
      laneId: 'LANE_3_CLIENT',
      branchName: 'lane/client/TASK-CLIENT-01',
      targetFiles: ['src/core/chat/ChatRuntime.ts'], // conflicting file
      assignedAt: new Date().toISOString(),
    };

    const result = coordinator.allocateTask(alloc2);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('File conflict detected'))).toBe(true);
  });

  it('releases allocated tasks cleanly', () => {
    const alloc: LaneTaskAllocation = {
      taskId: 'TASK-EVALS-01',
      laneId: 'LANE_4_EVALS',
      branchName: 'lane/evals/TASK-EVALS-01',
      targetFiles: ['src/core/evals/GoldenConversationRunner.ts'],
      assignedAt: new Date().toISOString(),
    };
    coordinator.allocateTask(alloc);
    expect(coordinator.getAllAllocations()).toHaveLength(1);

    coordinator.releaseTask('TASK-EVALS-01');
    expect(coordinator.getAllAllocations()).toHaveLength(0);
  });

  it('verifies pack promotion prerequisites against core readiness', () => {
    const incompleteCore = new Set(['P06', 'P07']);
    const check1 = coordinator.verifyPackPromotionPrerequisites('general_knowledge', incompleteCore);
    expect(check1.canPromote).toBe(false);
    expect(check1.missingCorePrerequisites).toContain('P08');
    expect(check1.missingCorePrerequisites).toContain('P09');

    const completeCore = new Set(['P06', 'P07', 'P08', 'P09']);
    const check2 = coordinator.verifyPackPromotionPrerequisites('general_knowledge', completeCore);
    expect(check2.canPromote).toBe(true);
    expect(check2.missingCorePrerequisites).toHaveLength(0);
  });
});
