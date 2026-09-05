import { describe, it, expect } from '@jest/globals';
import {
  DataCorpusDomain,
  FineTuningStatus,
  ContaminationAuditResult,
} from './training-separation';

describe('TrainingSeparation Types', () => {
  it('should enumerate all 3 isolated data domains', () => {
    const domains: DataCorpusDomain[] = ['rag', 'training', 'evaluation'];
    expect(domains).toHaveLength(3);
  });

  it('should enumerate 4 fine-tuning lifecycle statuses', () => {
    const statuses: FineTuningStatus[] = [
      'DISABLED',
      'LOCAL_ONLY_EXPERIMENTAL',
      'PRODUCTION_PREVIEW',
      'PRODUCTION_SUPPORTED',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('should validate ContaminationAuditResult structure', () => {
    const audit: ContaminationAuditResult = {
      hasContamination: false,
      evaluationOverlapsWithTraining: [],
      evaluationOverlapsWithRag: [],
      trainingOverlapsWithRag: [],
      totalEvaluationItems: 120,
      checkedAt: new Date().toISOString(),
    };
    expect(audit.hasContamination).toBe(false);
    expect(audit.totalEvaluationItems).toBe(120);
  });
});
