import {
  CRKPhaseIdSchema,
  MilestoneIdSchema,
  ParallelLaneIdSchema,
  DependencyNodeSchema,
  MilestoneDefinitionSchema,
  LaneTaskAllocationSchema,
} from './dependency-graph';

describe('Dependency Graph & Governance Schemas (Sections 38-40)', () => {
  it('validates CRK phases and milestones', () => {
    expect(CRKPhaseIdSchema.parse('P01')).toBe('P01');
    expect(CRKPhaseIdSchema.parse('P26')).toBe('P26');
    expect(MilestoneIdSchema.parse('MILESTONE_A')).toBe('MILESTONE_A');
    expect(MilestoneIdSchema.parse('MILESTONE_G')).toBe('MILESTONE_G');
  });

  it('validates dependency node schema', () => {
    const node = DependencyNodeSchema.parse({
      id: 'P07',
      name: 'Official Documentation Pack',
      isOptional: false,
      dependencies: ['P06'],
      milestone: 'MILESTONE_B',
      status: 'COMPLETED',
    });
    expect(node.id).toBe('P07');
    expect(node.dependencies).toContain('P06');
  });

  it('validates lane task allocation schema', () => {
    const allocation = LaneTaskAllocationSchema.parse({
      taskId: 'CRK-P11-T01',
      laneId: 'LANE_1_RUNTIME',
      branchName: 'lane/runtime/CRK-P11-T01',
      targetFiles: ['src/core/prompt/PromptAssembler.ts'],
      assignedAt: new Date().toISOString(),
    });
    expect(allocation.laneId).toBe('LANE_1_RUNTIME');
  });
});
