import { CodingEvalHarness } from './CodingEvalHarness';

describe('CodingEvalHarness', () => {
  it('grades repository evidence instead of answer plausibility', async () => {
    const report = await new CodingEvalHarness().run([{ id: 'go-fix', prompt: 'repair the Go package', expectedFiles: ['pkg/a.go'], requiredVerification: true }], async () => ({
      selectedFiles: ['pkg/a.go'], changedFiles: ['pkg/a.go'], buildPassed: true, testsPassed: true, hiddenChecksPassed: true, securityFindings: 0, verificationClaimed: true, verificationRecorded: true
    }));
    expect(report.passed).toBe(1);
    expect(report.scores[0].metrics.correctness).toBe(1);
  });

  it('detects false verification claims and unrelated changes', () => {
    const score = new CodingEvalHarness().score({ id: 'case', prompt: 'fix', expectedFiles: ['a.ts'], forbiddenFiles: ['README.md'], requiredVerification: true }, {
      selectedFiles: ['a.ts'], changedFiles: ['a.ts', 'README.md'], buildPassed: true, testsPassed: true, hiddenChecksPassed: true, securityFindings: 0, verificationClaimed: true, verificationRecorded: false
    });
    expect(score.passed).toBe(false);
    expect(score.failures).toEqual(expect.arrayContaining(['unnecessary_or_forbidden_file_changed', 'verification_claim_does_not_match_record', 'required_verification_missing']));
  });

  it('scores selection, API accuracy, root cause, and review quality as first-class metrics', () => {
    const harness = new CodingEvalHarness();
    const score = harness.score({ id: 'quality', prompt: 'repair', expectedFiles: ['src/a.ts'], expectedSymbols: ['loadUser'], expectedReviewFindings: 1 }, {
      selectedFiles: ['src/other.ts'], selectedSymbols: [], changedFiles: ['src/a.ts'], buildPassed: true, testsPassed: true,
      hiddenChecksPassed: true, securityFindings: 0, apiHallucinations: 1, rootCauseAccurate: false, unnecessaryChanges: 1,
      reviewFindings: 0, verificationClaimed: true, verificationRecorded: true
    });

    expect(score.metrics.fileSelection).toBe(0);
    expect(score.metrics.symbolSelection).toBe(0);
    expect(score.metrics.apiAccuracy).toBe(0);
    expect(score.metrics.rootCauseAccuracy).toBe(0);
    expect(score.metrics.reviewQuality).toBe(0);
    expect(score.failures).toEqual(expect.arrayContaining(['api_or_version_hallucination', 'root_cause_inaccurate', 'review_defect_missed']));
  });
});
