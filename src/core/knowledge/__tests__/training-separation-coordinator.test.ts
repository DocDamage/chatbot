import { describe, it, expect, beforeEach } from '@jest/globals';
import { TrainingSeparationCoordinator } from '../TrainingSeparationCoordinator';
import { CorpusEntry, FineTuningPrerequisites } from '../../../types/training-separation';

describe('TrainingSeparationCoordinator (§53)', () => {
  let coordinator: TrainingSeparationCoordinator;

  beforeEach(() => {
    coordinator = new TrainingSeparationCoordinator();
  });

  it('should register isolated entries across rag, training, and evaluation without contamination', () => {
    const ragEntry: CorpusEntry = {
      id: 'rag-1',
      domain: 'rag',
      contentHash: 'hash-rag-1',
      description: 'Official API docs',
      itemCount: 50,
      addedAt: new Date().toISOString(),
    };
    const evalEntry: CorpusEntry = {
      id: 'eval-1',
      domain: 'evaluation',
      contentHash: 'hash-eval-1',
      description: 'Golden held-out test case',
      itemCount: 1,
      addedAt: new Date().toISOString(),
    };

    coordinator.registerEntry(ragEntry);
    coordinator.registerEntry(evalEntry);

    const audit = coordinator.runContaminationAudit();
    expect(audit.hasContamination).toBe(false);
    expect(audit.totalEvaluationItems).toBe(1);
  });

  it('should strictly reject adding training/rag item that collides with evaluation (§53.3)', () => {
    const evalEntry: CorpusEntry = {
      id: 'eval-secret',
      domain: 'evaluation',
      contentHash: 'shared-hash-xyz',
      description: 'Secret evaluation benchmark',
      itemCount: 1,
      addedAt: new Date().toISOString(),
    };
    coordinator.registerEntry(evalEntry);

    const contaminatedTrainingEntry: CorpusEntry = {
      id: 'training-leaked',
      domain: 'training',
      contentHash: 'shared-hash-xyz',
      description: 'Leaked training sample',
      itemCount: 1,
      addedAt: new Date().toISOString(),
    };

    expect(() => coordinator.registerEntry(contaminatedTrainingEntry)).toThrow(
      /Contamination rejection \(§53\.3\)/
    );
  });

  it('should enforce §53.4 fine-tuning status restrictions when prerequisites are missing', () => {
    const incompletePrereqs: FineTuningPrerequisites = {
      trainingTargetSelected: true,
      licenseAndPrivacyReviewed: false, // missing!
      evaluationsProveMeasurableBenefit: false, // missing!
      rollbackAndVersionPolicyConfigured: true,
    };

    const assessment = coordinator.assessFineTuningReadiness(
      'PRODUCTION_SUPPORTED',
      incompletePrereqs
    );

    expect(assessment.isProductionReady).toBe(false);
    expect(assessment.currentStatus).toBe('LOCAL_ONLY_EXPERIMENTAL');
    expect(assessment.missingPrerequisites).toHaveLength(2);
    expect(assessment.allowedStatuses).not.toContain('PRODUCTION_SUPPORTED');
  });

  it('should allow PRODUCTION_SUPPORTED when all 4 prerequisites are certified', () => {
    const completePrereqs: FineTuningPrerequisites = {
      trainingTargetSelected: true,
      targetDetails: 'LoRA on local Ollama runtime',
      licenseAndPrivacyReviewed: true,
      evaluationsProveMeasurableBenefit: true,
      benefitMetricsSummary: '+12% accuracy on domain QA',
      rollbackAndVersionPolicyConfigured: true,
    };

    const assessment = coordinator.assessFineTuningReadiness(
      'PRODUCTION_SUPPORTED',
      completePrereqs
    );

    expect(assessment.isProductionReady).toBe(true);
    expect(assessment.currentStatus).toBe('PRODUCTION_SUPPORTED');
    expect(assessment.missingPrerequisites).toHaveLength(0);
    expect(assessment.allowedStatuses).toContain('PRODUCTION_SUPPORTED');
  });
});
