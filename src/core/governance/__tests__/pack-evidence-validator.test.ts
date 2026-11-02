import { describe, it, expect } from '@jest/globals';
import { KnowledgePackEvidenceValidator } from '../KnowledgePackEvidenceValidator';

describe('KnowledgePackEvidenceValidator (§58)', () => {
  it('identifies file names matching required pack evidence artifacts', () => {
    const validator = new KnowledgePackEvidenceValidator();
    const files = [
      'manifest.json',
      'license-review.md',
      'source-version.json',
      'install-summary.json',
      'chunk-counts.json',
      'filter-counts.json',
      'duplicate-counts.json',
      'embedding-model.json',
      'storage-report.json',
      'retrieval-benchmark.json',
      'ab-comparison.json',
      'latency-impact.json',
      'known-limitations.md',
      'update-policy.md',
      'rollback-evidence.json',
    ];

    const recognized = validator.validateEvidenceFileNames(files);
    expect(recognized).toHaveLength(15);
  });

  it('audits default-promoted pack and reports missing artifacts', () => {
    const validator = new KnowledgePackEvidenceValidator();
    const partialAudit = validator.auditEvidence('developer-qa-pack', true, [
      'manifest',
      'license_review',
      'source_version',
    ]);

    expect(partialAudit.isFullyEvidenced).toBe(false);
    expect(partialAudit.missingArtifacts.length).toBe(12);

    const fullAudit = validator.auditEvidence(
      'developer-qa-pack',
      true,
      KnowledgePackEvidenceValidator.REQUIRED_ARTIFACTS
    );
    expect(fullAudit.isFullyEvidenced).toBe(true);
    expect(fullAudit.missingArtifacts).toHaveLength(0);
  });
});
