import {
  DataCorpusDomain,
  FineTuningStatus,
  CorpusEntry,
  ContaminationAuditResult,
  FineTuningPrerequisites,
  FineTuningGovernanceAssessment,
} from '../../types/training-separation';

export class TrainingSeparationCoordinator {
  private registries: Record<DataCorpusDomain, Map<string, CorpusEntry>> = {
    rag: new Map(),
    training: new Map(),
    evaluation: new Map(),
  };

  public registerEntry(entry: CorpusEntry): void {
    // Check if adding to training or rag would contaminate with existing evaluation items
    if (entry.domain === 'training' || entry.domain === 'rag') {
      const evalEntries = Array.from(this.registries.evaluation.values());
      const match = evalEntries.find((e) => e.contentHash === entry.contentHash || e.id === entry.id);
      if (match) {
        throw new Error(
          `Contamination rejection (§53.3): Cannot add entry '${entry.id}' to ${entry.domain}; hash matches held-out evaluation entry '${match.id}'.`
        );
      }
    } else if (entry.domain === 'evaluation') {
      // Check if adding to evaluation conflicts with existing training or rag items
      const trainingMatch = Array.from(this.registries.training.values()).find(
        (e) => e.contentHash === entry.contentHash || e.id === entry.id
      );
      if (trainingMatch) {
        throw new Error(
          `Contamination rejection (§53.3): Evaluation entry '${entry.id}' overlaps with existing training entry '${trainingMatch.id}'.`
        );
      }
      const ragMatch = Array.from(this.registries.rag.values()).find(
        (e) => e.contentHash === entry.contentHash || e.id === entry.id
      );
      if (ragMatch) {
        throw new Error(
          `Contamination rejection (§53.3): Evaluation entry '${entry.id}' overlaps with existing RAG entry '${ragMatch.id}'.`
        );
      }
    }

    this.registries[entry.domain].set(entry.id, entry);
  }

  public getEntries(domain: DataCorpusDomain): CorpusEntry[] {
    return Array.from(this.registries[domain].values());
  }

  public runContaminationAudit(): ContaminationAuditResult {
    const evalEntries = Array.from(this.registries.evaluation.values());
    const trainingEntries = Array.from(this.registries.training.values());
    const ragEntries = Array.from(this.registries.rag.values());

    const evalTrainingOverlap: string[] = [];
    const evalRagOverlap: string[] = [];
    const trainingRagOverlap: string[] = [];

    const trainingHashes = new Set(trainingEntries.map((e) => e.contentHash));
    const ragHashes = new Set(ragEntries.map((e) => e.contentHash));

    for (const ev of evalEntries) {
      if (trainingHashes.has(ev.contentHash)) {
        evalTrainingOverlap.push(ev.id);
      }
      if (ragHashes.has(ev.contentHash)) {
        evalRagOverlap.push(ev.id);
      }
    }

    for (const tr of trainingEntries) {
      if (ragHashes.has(tr.contentHash)) {
        trainingRagOverlap.push(tr.id);
      }
    }

    const hasContamination =
      evalTrainingOverlap.length > 0 ||
      evalRagOverlap.length > 0 ||
      trainingRagOverlap.length > 0;

    return {
      hasContamination,
      evaluationOverlapsWithTraining: evalTrainingOverlap,
      evaluationOverlapsWithRag: evalRagOverlap,
      trainingOverlapsWithRag: trainingRagOverlap,
      totalEvaluationItems: evalEntries.length,
      checkedAt: new Date().toISOString(),
    };
  }

  public assessFineTuningReadiness(
    requestedStatus: FineTuningStatus,
    prereqs: FineTuningPrerequisites
  ): FineTuningGovernanceAssessment {
    const missing: string[] = [];

    if (!prereqs.trainingTargetSelected) {
      missing.push('Supported local/remote training target must be selected');
    }
    if (!prereqs.licenseAndPrivacyReviewed) {
      missing.push('Data license and privacy must be reviewed and approved');
    }
    if (!prereqs.evaluationsProveMeasurableBenefit) {
      missing.push('Held-out evaluations must prove measurable answer quality benefit');
    }
    if (!prereqs.rollbackAndVersionPolicyConfigured) {
      missing.push('Model rollback and model-versioning policy must be established');
    }

    const isProductionReady = missing.length === 0;

    let currentStatus = requestedStatus;
    // §53.4: Fine-tuning must remain PRODUCTION_PREVIEW or LOCAL_ONLY_EXPERIMENTAL until all 4 criteria are fulfilled
    if (requestedStatus === 'PRODUCTION_SUPPORTED' && !isProductionReady) {
      currentStatus = 'LOCAL_ONLY_EXPERIMENTAL';
    }

    const allowedStatuses: FineTuningStatus[] = isProductionReady
      ? ['DISABLED', 'LOCAL_ONLY_EXPERIMENTAL', 'PRODUCTION_PREVIEW', 'PRODUCTION_SUPPORTED']
      : ['DISABLED', 'LOCAL_ONLY_EXPERIMENTAL', 'PRODUCTION_PREVIEW'];

    return {
      currentStatus,
      allowedStatuses,
      isProductionReady,
      missingPrerequisites: missing,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
