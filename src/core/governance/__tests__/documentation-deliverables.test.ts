import {
  DocumentationDeliverablesAuditor,
  REQUIRED_DOCUMENTATION_SPECS
} from '../DocumentationDeliverablesAuditor';

describe('DocumentationDeliverablesAuditor (§47)', () => {
  let auditor: DocumentationDeliverablesAuditor;

  beforeEach(() => {
    auditor = new DocumentationDeliverablesAuditor();
  });

  it('specifies all 12 required documentation deliverables', () => {
    expect(REQUIRED_DOCUMENTATION_SPECS.length).toBe(12);
  });

  it('audits all 12 deliverables successfully and confirms compliance', () => {
    const report = auditor.auditAll();

    expect(report.totalRequired).toBe(12);
    expect(report.compliantCount).toBe(12);
    expect(report.allCompliant).toBe(true);

    for (const result of report.results) {
      expect(result.exists).toBe(true);
      expect(result.wordCount).toBeGreaterThanOrEqual(50);
      expect(result.missingHeadings).toHaveLength(0);
      expect(result.compliant).toBe(true);
    }
  });

  it('detects missing files gracefully', () => {
    const missingResult = auditor.auditSingle({
      path: 'docs/non_existent_file.md' as any,
      category: 'architecture',
      title: 'Non-existent Doc',
      minWordCount: 50,
      requiredHeadings: ['Overview']
    });

    expect(missingResult.exists).toBe(false);
    expect(missingResult.compliant).toBe(false);
    expect(missingResult.error).toContain('File not found');
  });
});
