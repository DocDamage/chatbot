/**
 * Section 39: Recommended Milestones Engine
 * Tracks Milestones A through G across CRK phases.
 */
import {
  CRKPhaseId,
  MilestoneId,
  MilestoneDefinition,
} from '../../types/dependency-graph';

export const CANONICAL_MILESTONES: Record<MilestoneId, MilestoneDefinition> = {
  MILESTONE_A: {
    id: 'MILESTONE_A',
    name: 'Milestone A — Runtime Consolidation',
    description: 'Consolidates base runtime into one pipeline with intentional context planning.',
    phases: ['P00', 'P01', 'P02', 'P03', 'P04', 'P05'],
    successCriteria: [
      'one canonical pipeline exists',
      'follow-up state works',
      'context is planned intentionally',
    ],
  },
  MILESTONE_B: {
    id: 'MILESTONE_B',
    name: 'Milestone B — Governed Knowledge Core',
    description: 'Delivers dataset infrastructure and official documentation with authority/version control.',
    phases: ['P06', 'P07', 'P08', 'P09'],
    successCriteria: [
      'official docs can be installed/routed with authority/version control',
    ],
  },
  MILESTONE_C: {
    id: 'MILESTONE_C',
    name: 'Milestone C — Model + Prompt Reliability',
    description: 'Enforces model routing, budgeted prompts, and honest abstention on missing evidence.',
    phases: ['P10', 'P11', 'P12'],
    successCriteria: [
      'model routing is current/configured',
      'prompts are budgeted/versioned',
      'insufficient evidence produces controlled behavior',
    ],
  },
  MILESTONE_D: {
    id: 'MILESTONE_D',
    name: 'Milestone D — Coding Knowledge Expansion',
    description: 'Adds developer Q&A and curated code repositories to elevate coding capabilities.',
    phases: ['P13', 'P14'],
    successCriteria: [
      'Q&A and curated code improve coding benchmark',
    ],
  },
  MILESTONE_E: {
    id: 'MILESTONE_E',
    name: 'Milestone E — Trust and Improvement Loop',
    description: 'Unified citations, feedback, tool truthfulness, diagnostics, and golden regression.',
    phases: ['P15', 'P16', 'P17', 'P18', 'P23', 'P24', 'P25'],
    successCriteria: [
      'sources are visible',
      'feedback is unified',
      'tool claims are truthful',
      'failures are diagnosable',
      'regression suite measures quality',
    ],
  },
  MILESTONE_F: {
    id: 'MILESTONE_F',
    name: 'Milestone F — Broad Knowledge',
    description: 'General knowledge, math, science, and multilingual packs promoted only by evidence.',
    phases: ['P19', 'P20', 'P21', 'P22'],
    successCriteria: [
      'broad datasets promoted only by evidence',
    ],
  },
  MILESTONE_G: {
    id: 'MILESTONE_G',
    name: 'Milestone G — Production Maintenance/Cutover',
    description: 'Background maintenance, cutover verification, and legacy orchestrator deprecation.',
    phases: ['P26'],
    successCriteria: [
      'automated refresh pipeline operational',
      'release cutover gates verified',
      'legacy orchestrator safely deprecated',
    ],
  },
};

export interface MilestoneEvaluation {
  milestoneId: MilestoneId;
  name: string;
  isComplete: boolean;
  completedPhasesCount: number;
  totalPhasesCount: number;
  missingPhases: CRKPhaseId[];
  successCriteria: string[];
}

export class MilestoneManager {
  private milestones: Map<MilestoneId, MilestoneDefinition>;

  constructor(customMilestones?: Record<MilestoneId, MilestoneDefinition>) {
    this.milestones = new Map();
    const source = customMilestones || CANONICAL_MILESTONES;
    for (const [key, val] of Object.entries(source)) {
      this.milestones.set(key as MilestoneId, { ...val });
    }
  }

  getMilestone(id: MilestoneId): MilestoneDefinition | undefined {
    return this.milestones.get(id);
  }

  getAllMilestones(): MilestoneDefinition[] {
    return Array.from(this.milestones.values());
  }

  evaluateMilestone(
    milestoneId: MilestoneId,
    completedPhases: Set<CRKPhaseId>,
  ): MilestoneEvaluation {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone) {
      throw new Error(`Unknown milestone: ${milestoneId}`);
    }

    const missingPhases = milestone.phases.filter((p) => !completedPhases.has(p));
    const completedPhasesCount = milestone.phases.length - missingPhases.length;

    return {
      milestoneId,
      name: milestone.name,
      isComplete: missingPhases.length === 0,
      completedPhasesCount,
      totalPhasesCount: milestone.phases.length,
      missingPhases,
      successCriteria: milestone.successCriteria,
    };
  }

  evaluateAllMilestones(completedPhases: Set<CRKPhaseId>): MilestoneEvaluation[] {
    return this.getAllMilestones().map((m) =>
      this.evaluateMilestone(m.id, completedPhases),
    );
  }

  areAllMilestonesComplete(completedPhases: Set<CRKPhaseId>): boolean {
    const evals = this.evaluateAllMilestones(completedPhases);
    return evals.every((e) => e.isComplete);
  }
}
