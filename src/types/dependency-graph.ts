/**
 * Section 38, 39, 40: Dependency Graph, Milestones, and Concurrency Schemas
 */
import { z } from 'zod';

export const CRKPhaseIdSchema = z.enum([
  'P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09',
  'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P17', 'P18', 'P19',
  'P20', 'P21', 'P22', 'P23', 'P24', 'P25', 'P26',
]);
export type CRKPhaseId = z.infer<typeof CRKPhaseIdSchema>;

export const MilestoneIdSchema = z.enum([
  'MILESTONE_A',
  'MILESTONE_B',
  'MILESTONE_C',
  'MILESTONE_D',
  'MILESTONE_E',
  'MILESTONE_F',
  'MILESTONE_G',
]);
export type MilestoneId = z.infer<typeof MilestoneIdSchema>;

export const ParallelLaneIdSchema = z.enum([
  'LANE_1_RUNTIME',
  'LANE_2_KNOWLEDGE_ADAPTERS',
  'LANE_3_CLIENT',
  'LANE_4_EVALS',
]);
export type ParallelLaneId = z.infer<typeof ParallelLaneIdSchema>;

export const DependencyNodeSchema = z.object({
  id: CRKPhaseIdSchema,
  name: z.string(),
  isOptional: z.boolean(),
  dependencies: z.array(CRKPhaseIdSchema),
  milestone: MilestoneIdSchema,
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']),
});
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

export const MilestoneDefinitionSchema = z.object({
  id: MilestoneIdSchema,
  name: z.string(),
  description: z.string(),
  phases: z.array(CRKPhaseIdSchema),
  successCriteria: z.array(z.string()),
});
export type MilestoneDefinition = z.infer<typeof MilestoneDefinitionSchema>;

export const LaneTaskAllocationSchema = z.object({
  taskId: z.string(),
  laneId: ParallelLaneIdSchema,
  branchName: z.string(),
  targetFiles: z.array(z.string()),
  assignedAt: z.string(),
});
export type LaneTaskAllocation = z.infer<typeof LaneTaskAllocationSchema>;
