import {
  MilestoneManager,
  CANONICAL_MILESTONES,
} from '../MilestoneManager';
import { CRKPhaseId } from '../../../types/dependency-graph';

describe('MilestoneManager (Section 39 Recommended Milestones)', () => {
  let manager: MilestoneManager;

  beforeEach(() => {
    manager = new MilestoneManager();
  });

  it('contains all 7 canonical milestones (A through G)', () => {
    const milestones = manager.getAllMilestones();
    expect(milestones).toHaveLength(7);
  });

  it('evaluates Milestone A complete when P00-P05 are completed', () => {
    const completed = new Set<CRKPhaseId>(['P00', 'P01', 'P02', 'P03', 'P04', 'P05']);
    const result = manager.evaluateMilestone('MILESTONE_A', completed);
    expect(result.isComplete).toBe(true);
    expect(result.missingPhases).toHaveLength(0);
    expect(result.completedPhasesCount).toBe(6);
  });

  it('detects missing phases for incomplete milestones', () => {
    const completed = new Set<CRKPhaseId>(['P06', 'P07']);
    const result = manager.evaluateMilestone('MILESTONE_B', completed);
    expect(result.isComplete).toBe(false);
    expect(result.missingPhases).toContain('P08');
    expect(result.missingPhases).toContain('P09');
  });

  it('certifies all milestones complete when all CRK phases are completed', () => {
    const allPhases = new Set<CRKPhaseId>([
      'P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09',
      'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P17', 'P18', 'P19',
      'P20', 'P21', 'P22', 'P23', 'P24', 'P25', 'P26',
    ]);
    const allComplete = manager.areAllMilestonesComplete(allPhases);
    expect(allComplete).toBe(true);
  });
});
