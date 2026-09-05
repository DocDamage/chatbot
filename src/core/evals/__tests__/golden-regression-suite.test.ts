import {
  HUMAN_REVIEWED_SEED_CASES,
  generateFullGoldenSuite,
} from '../golden-dataset-seed';
import { GoldenConversationRunner } from '../GoldenConversationRunner';

describe('Phase 24: Golden Conversation and Runtime Regression Suite', () => {
  const runner = new GoldenConversationRunner();

  it('generates a full 500-case catalog with strict knowledge isolation (§3600)', () => {
    const suite = generateFullGoldenSuite();
    expect(suite.length).toBeGreaterThanOrEqual(500);

    // Contamination control check: every case must be marked isolated
    for (const c of suite) {
      expect(c.isolatedFromKnowledgeIndex).toBe(true);
    }
  });

  it('evaluates seed cases with deterministic assertions', () => {
    // 1. Followup recall
    const followupCase = HUMAN_REVIEWED_SEED_CASES.find(c => c.id === 'case-followup-01')!;
    const followupRes = runner.evaluateCase(followupCase, {
      text: 'You previously mentioned that your favorite language is Rust.',
    });
    expect(followupRes.passed).toBe(true);

    // 2. Coding
    const codingCase = HUMAN_REVIEWED_SEED_CASES.find(c => c.id === 'case-coding-01')!;
    const codingRes = runner.evaluateCase(codingCase, {
      text: 'function isPalindrome(str: string): boolean { return str === str.split("").reverse().join(""); }',
    });
    expect(codingRes.passed).toBe(true);

    // 3. Security refusal
    const refusalCase = HUMAN_REVIEWED_SEED_CASES.find(c => c.id === 'case-permissions-01')!;
    const refusalRes = runner.evaluateCase(refusalCase, {
      text: 'I cannot reveal environment credentials or secrets as prohibited by policy.',
    });
    expect(refusalRes.passed).toBe(true);

    // 4. Memory variable
    const memoryCase = HUMAN_REVIEWED_SEED_CASES.find(c => c.id === 'case-memory-01')!;
    const memoryRes = runner.evaluateCase(memoryCase, {
      text: 'We are targeting linux.',
      variables: { target_os: 'linux' },
    });
    expect(memoryRes.passed).toBe(true);
  });

  it('detects violations and assertion failures accurately', () => {
    // Missing required substring
    const codingCase = HUMAN_REVIEWED_SEED_CASES.find(c => c.id === 'case-coding-01')!;
    const badCodingRes = runner.evaluateCase(codingCase, {
      text: 'Here is some python code: def palindrome(s): return True',
    });
    expect(badCodingRes.passed).toBe(false);

    // Failing refusal
    const refusalCase = HUMAN_REVIEWED_SEED_CASES.find(c => c.id === 'case-permissions-01')!;
    const leakRes = runner.evaluateCase(refusalCase, {
      text: 'The value is process.env.API_SECRET_KEY = 12345',
    });
    expect(leakRes.passed).toBe(false);
  });

  it('executes PR smoke tier of 50 deterministic cases and computes baseline metrics', () => {
    const suite = generateFullGoldenSuite().slice(0, 50);
    const executionResults = suite.map(c => {
      let text = 'Compliant execution response without overclaim.';
      const variables: Record<string, unknown> = {};
      const toolStates: Record<string, string> = {};

      if (c.id === 'case-followup-01') text = 'Your favorite language is Rust.';
      if (c.id === 'case-coding-01') text = 'function isPalindrome(str: string): boolean { return true; }';
      if (c.id === 'case-debug-01') text = 'Use items?.map to handle undefined safe access.';
      if (c.id === 'case-project-01') text = 'Use npm run build.';
      if (c.id === 'case-research-01') text = 'Runs in O(n) average and O(n^2) worst case.';
      if (c.id === 'case-memory-01') {
        text = 'linux';
        variables.target_os = 'linux';
      }
      if (c.id === 'case-tool-01') {
        text = 'Test runner failed.';
        toolStates.test_runner = 'failed';
      }
      if (c.id === 'case-fallback-01') text = 'Calculates shortest path in graph.';
      if (c.id === 'case-permissions-01') text = 'I cannot reveal secrets as prohibited by policy.';

      return runner.evaluateCase(c, {
        text,
        variables,
        toolStates,
        latencyMs: 65,
      });
    });

    const metrics = runner.calculateMetrics(executionResults);
    expect(metrics.totalCases).toBe(50);
    expect(metrics.taskSuccessRate).toBeGreaterThanOrEqual(0.95);
    expect(metrics.unsupportedClaimRate).toBeLessThanOrEqual(0.05);
    expect(metrics.toolTruthfulnessRate).toBe(1.0);
  });
});
