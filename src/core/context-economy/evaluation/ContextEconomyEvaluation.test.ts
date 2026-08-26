import { ContextBenchmarkSuite } from './ContextBenchmarkSuite';
import { ContextContentRouter } from '../router/ContextContentRouter';
import { ContextBudgetPlanner } from '../budgets/ContextBudgetPlanner';

describe('ContextEconomyEvaluation (PX-03 / PX03-T01 & PX03-T10)', () => {
  it('runs benchmark suite and achieves token reduction with 100% critical anchor retention', async () => {
    const suite = new ContextBenchmarkSuite();
    const benchmark = await suite.runBenchmark();

    expect(benchmark.totalItems).toBeGreaterThanOrEqual(4);
    expect(benchmark.averageReductionPercentage).toBeGreaterThan(15);
    expect(benchmark.overallAnchorRetentionRate).toBe(1.0); // 100% of critical anchors retained

    // Verify individual benchmark items
    for (const item of benchmark.results) {
      expect(item.originalBytes).toBeGreaterThan(item.compressedBytes);
      expect(item.retainedAnchorsRate).toBe(1.0);
    }
  });

  it('correctly classifies diverse context inputs and routes to compressors', () => {
    const router = ContextContentRouter.getInstance();

    // 1. JSON
    const jsonRes = router.classify('{"key": "value", "items": [1, 2, 3]}');
    expect(jsonRes.category).toBe('json_payload');

    // 2. Git Diff
    const diffRes = router.classify('diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt');
    expect(diffRes.category).toBe('git_diff');

    // 3. Stack Trace
    const stackRes = router.classify('TypeError: Cannot read properties of undefined\n    at Object.test (file.js:10:5)');
    expect(stackRes.category).toBe('stack_trace');

    // 4. Source Code
    const codeRes = router.classify('export class AuthTokenManager { private secret = "123"; }');
    expect(codeRes.category).toBe('source_code');
  });

  it('allocates context budget explainably and records dropped items', () => {
    const plan = ContextBudgetPlanner.planBudget({
      totalWindowTokens: 1000,
      systemPrompt: 'System instruction prompt',
      toolSchemasText: '{"tools": []}',
      responseReserveTokens: 200,
      items: [
        { id: 'query', category: 'user_query', content: 'What is wrong with my code?', estimatedTokens: 50, priority: 1 },
        { id: 'code_slice', category: 'code_evidence', content: 'class UserService {}', estimatedTokens: 200, priority: 2 },
        { id: 'huge_log', category: 'diagnostics', content: 'massive log stream...', estimatedTokens: 800, priority: 5 }
      ]
    });

    expect(plan.allocated.userQuery).toBe(50);
    expect(plan.allocated.codeEvidence).toBe(200);
    expect(plan.droppedItems.length).toBe(1);
    expect(plan.droppedItems[0].item).toBe('huge_log');
    expect(plan.droppedItems[0].reason).toContain('Insufficient context budget');
  });
});
