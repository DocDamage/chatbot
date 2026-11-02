import {
  RequiredPackEvidenceArtifact,
  PackEvidenceAuditResult,
} from '../../types/program-completion';

export class KnowledgePackEvidenceValidator {
  public static readonly REQUIRED_ARTIFACTS: RequiredPackEvidenceArtifact[] = [
    'manifest',
    'license_review',
    'source_version',
    'install_evidence',
    'document_chunk_counts',
    'filter_counts',
    'duplicate_counts',
    'embedding_model_version',
    'storage_size',
    'retrieval_benchmark',
    'answer_quality_ab',
    'latency_impact',
    'known_limitations',
    'update_policy',
    'rollback_evidence',
  ];

  public auditEvidence(
    packId: string,
    isDefaultPromoted: boolean,
    presentArtifacts: RequiredPackEvidenceArtifact[]
  ): PackEvidenceAuditResult {
    const presentSet = new Set(presentArtifacts);
    const missingArtifacts: RequiredPackEvidenceArtifact[] = [];

    for (const required of KnowledgePackEvidenceValidator.REQUIRED_ARTIFACTS) {
      if (!presentSet.has(required)) {
        missingArtifacts.push(required);
      }
    }

    const isFullyEvidenced = !isDefaultPromoted || missingArtifacts.length === 0;

    return {
      packId,
      isDefaultPromoted,
      totalRequiredArtifacts: KnowledgePackEvidenceValidator.REQUIRED_ARTIFACTS.length,
      presentArtifacts: Array.from(presentSet),
      missingArtifacts,
      isFullyEvidenced,
    };
  }

  public validateEvidenceFileNames(fileNames: string[]): RequiredPackEvidenceArtifact[] {
    const recognized: RequiredPackEvidenceArtifact[] = [];
    const normalized = fileNames.map((f) => f.toLowerCase());

    const patterns: Record<RequiredPackEvidenceArtifact, RegExp> = {
      manifest: /manifest(\.json|\.md)?$/,
      license_review: /license[-_]review(\.md|\.json)?$/,
      source_version: /(source[-_]version|version[-_]metadata)(\.json|\.md)?$/,
      install_evidence: /install[-_](summary|evidence)(\.json|\.md)?$/,
      document_chunk_counts: /(chunk[-_]counts|doc[-_]counts)(\.json|\.md)?$/,
      filter_counts: /filter[-_]counts(\.json|\.md)?$/,
      duplicate_counts: /duplicate[-_]counts(\.json|\.md)?$/,
      embedding_model_version: /embedding[-_]model(\.json|\.md)?$/,
      storage_size: /storage[-_](report|size)(\.json|\.md)?$/,
      retrieval_benchmark: /retrieval[-_](benchmark|eval)(\.json|\.md)?$/,
      answer_quality_ab: /(ab[-_]comparison|quality[-_]ab)(\.json|\.md)?$/,
      latency_impact: /latency[-_]impact(\.json|\.md)?$/,
      known_limitations: /known[-_]limitations(\.md|\.json)?$/,
      update_policy: /update[-_]policy(\.md|\.json)?$/,
      rollback_evidence: /rollback[-_]evidence(\.json|\.md)?$/,
    };

    for (const [artifact, regex] of Object.entries(patterns) as [RequiredPackEvidenceArtifact, RegExp][]) {
      if (normalized.some((name) => regex.test(name))) {
        recognized.push(artifact);
      }
    }

    return recognized;
  }
}
