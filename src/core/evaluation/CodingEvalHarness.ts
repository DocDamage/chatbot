export interface CodingEvalCase {
  id: string;
  prompt: string;
  expectedFiles?: string[];
  expectedSymbols?: string[];
  forbiddenFiles?: string[];
  hiddenChecks?: string[];
  requiredVerification?: boolean;
  securitySensitive?: boolean;
  expectedReviewFindings?: number;
}

export interface CodingEvalTrace {
  selectedFiles: string[];
  selectedSymbols?: string[];
  changedFiles: string[];
  buildPassed: boolean;
  testsPassed: boolean;
  hiddenChecksPassed: boolean;
  securityFindings: number;
  apiHallucinations?: number;
  rootCauseAccurate?: boolean;
  unnecessaryChanges?: number;
  reviewFindings?: number;
  verificationClaimed: boolean;
  verificationRecorded: boolean;
}

export interface CodingEvalScore {
  id: string;
  passed: boolean;
  metrics: { correctness: number; buildTest: number; regression: number; minimality: number; retrieval: number; fileSelection: number; symbolSelection: number; apiAccuracy: number; rootCauseAccuracy: number; security: number; reviewQuality: number; verificationHonesty: number };
  failures: string[];
}

export interface CodingEvalReport { total: number; passed: number; failed: number; scores: CodingEvalScore[]; }

export class CodingEvalHarness {
  async run(cases: CodingEvalCase[], execute: (testCase: CodingEvalCase) => Promise<CodingEvalTrace>): Promise<CodingEvalReport> {
    const scores: CodingEvalScore[] = [];
    for (const testCase of cases) scores.push(this.score(testCase, await execute(testCase)));
    return { total: scores.length, passed: scores.filter(score => score.passed).length, failed: scores.filter(score => !score.passed).length, scores };
  }

  score(testCase: CodingEvalCase, trace: CodingEvalTrace): CodingEvalScore {
    const failures: string[] = [];
    const expected = testCase.expectedFiles || [];
    const selected = new Set(trace.selectedFiles);
    const changed = new Set(trace.changedFiles);
    const retrieval = expected.length ? expected.filter(file => selected.has(file)).length / expected.length : 1;
    const fileSelection = retrieval;
    const expectedSymbols = testCase.expectedSymbols || [];
    const selectedSymbols = new Set(trace.selectedSymbols || []);
    const symbolSelection = expectedSymbols.length ? expectedSymbols.filter(symbol => selectedSymbols.has(symbol)).length / expectedSymbols.length : 1;
    const unnecessaryChanges = trace.unnecessaryChanges || 0;
    const minimality = (testCase.forbiddenFiles || []).some(file => changed.has(file)) || unnecessaryChanges > 0 ? 0 : 1;
    const buildTest = Number(trace.buildPassed && trace.testsPassed);
    const regression = Number(trace.hiddenChecksPassed);
    const security = testCase.securitySensitive ? Number(trace.securityFindings === 0) : 1;
    const apiAccuracy = Number((trace.apiHallucinations || 0) === 0);
    const rootCauseAccuracy = trace.rootCauseAccurate === undefined ? 1 : Number(trace.rootCauseAccurate);
    const reviewQuality = testCase.expectedReviewFindings === undefined ? 1 : Number((trace.reviewFindings || 0) >= testCase.expectedReviewFindings);
    const verificationHonesty = Number(trace.verificationClaimed === trace.verificationRecorded);
    const correctness = Number(buildTest === 1 && regression === 1);
    if (retrieval < 1) failures.push('expected_files_not_retrieved');
    if (minimality < 1) failures.push('unnecessary_or_forbidden_file_changed');
    if (!buildTest) failures.push('build_or_visible_tests_failed');
    if (!regression) failures.push('hidden_regression_failed');
    if (!security) failures.push('security_findings_present');
    if (!apiAccuracy) failures.push('api_or_version_hallucination');
    if (!rootCauseAccuracy) failures.push('root_cause_inaccurate');
    if (!reviewQuality) failures.push('review_defect_missed');
    if (!verificationHonesty) failures.push('verification_claim_does_not_match_record');
    if (testCase.requiredVerification && !trace.verificationRecorded) failures.push('required_verification_missing');
    return { id: testCase.id, passed: failures.length === 0, metrics: { correctness, buildTest, regression, minimality, retrieval, fileSelection, symbolSelection, apiAccuracy, rootCauseAccuracy, security, reviewQuality, verificationHonesty }, failures };
  }
}
