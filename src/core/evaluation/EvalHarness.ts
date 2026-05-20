export interface EvalCase {
  id: string;
  query: string;
  expected_sources?: string[];
  must_contain?: string[];
  must_not_contain?: string[];
  answer_type?: 'grounded' | 'refusal' | 'general';
  max_latency_ms?: number;
  max_cost?: number;
}

export interface EvalAnswer {
  answer: string;
  sources: string[];
  latencyMs: number;
  cost: number;
  refused?: boolean;
}

export interface EvalResult {
  id: string;
  passed: boolean;
  retrievalPrecision: number;
  answerCorrect: boolean;
  citationCorrect: boolean;
  refusalCorrect: boolean;
  latencyOk: boolean;
  costOk: boolean;
  hallucinationFree: boolean;
  failures: string[];
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
}

export class EvalHarness {
  constructor(private readonly answerCase: (testCase: EvalCase) => Promise<EvalAnswer>) {}

  async runCases(cases: EvalCase[]): Promise<EvalReport> {
    const results: EvalResult[] = [];

    for (const testCase of cases) {
      const answer = await this.answerCase(testCase);
      results.push(this.grade(testCase, answer));
    }

    const passed = results.filter(result => result.passed).length;
    return {
      total: results.length,
      passed,
      failed: results.length - passed,
      results
    };
  }

  private grade(testCase: EvalCase, answer: EvalAnswer): EvalResult {
    const failures: string[] = [];
    const lowerAnswer = answer.answer.toLowerCase();
    const expectedSources = testCase.expected_sources || [];
    const mustContain = testCase.must_contain || [];
    const mustNotContain = testCase.must_not_contain || [];

    const matchedSources = expectedSources.filter(source => answer.sources.includes(source));
    const retrievalPrecision = expectedSources.length === 0 ? 1 : matchedSources.length / expectedSources.length;
    const citationCorrect = retrievalPrecision === 1;
    if (!citationCorrect) {
      failures.push('missing_expected_source');
    }

    const answerCorrect = mustContain.every(term => lowerAnswer.includes(term.toLowerCase()));
    if (!answerCorrect) {
      failures.push('missing_required_answer_terms');
    }

    const hallucinationFree = mustNotContain.every(term => !lowerAnswer.includes(term.toLowerCase()));
    if (!hallucinationFree) {
      failures.push('contained_forbidden_terms');
    }

    const refusalCorrect = testCase.answer_type === 'refusal' ? answer.refused === true : answer.refused !== true;
    if (!refusalCorrect) {
      failures.push('incorrect_refusal_behavior');
    }

    const latencyOk = testCase.max_latency_ms ? answer.latencyMs <= testCase.max_latency_ms : true;
    if (!latencyOk) {
      failures.push('latency_exceeded');
    }

    const costOk = testCase.max_cost !== undefined ? answer.cost <= testCase.max_cost : true;
    if (!costOk) {
      failures.push('cost_exceeded');
    }

    return {
      id: testCase.id,
      passed: failures.length === 0,
      retrievalPrecision,
      answerCorrect,
      citationCorrect,
      refusalCorrect,
      latencyOk,
      costOk,
      hallucinationFree,
      failures
    };
  }
}
