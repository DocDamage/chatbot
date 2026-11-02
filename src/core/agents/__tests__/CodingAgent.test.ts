import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CodingAgent } from '../CodingAgent';

describe('B75-08: CodingAgent Decision and Execution Matrix', () => {
  let tempDir: string;
  let agent: CodingAgent;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-agent-test-'));
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-app', scripts: { test: 'jest' } }), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export function add(a: number, b: number): number { return a + b; }\n', 'utf8');

    agent = new CodingAgent({
      workspaceRoot: tempDir
    });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('classifies intents and handles planning, evidence gathering, and patch generation', async () => {
    const intent = agent.classifyIntent('Fix bug in token validation function');
    expect(intent).toBeDefined();

    const plan = await agent.plan('Add new subtraction function');
    expect(plan.intent).toBeDefined();
    expect(plan.steps.length).toBeGreaterThan(0);

    const handleResult = await agent.handle({
      message: 'Refactor math utilities in index.ts',
      runVerification: false
    });

    expect(handleResult.intent).toBeDefined();
    expect(handleResult.plan).toBeDefined();
    expect(handleResult.context).toBeDefined();
    expect(handleResult.review).toBeDefined();
    expect(handleResult.nextStep).toContain('/api/code/verify');
  });

  it('retrieves evidence from repository snapshot and symbol index', async () => {
    const evidence = await agent.retrieveEvidence({
      query: 'function add',
      symbols: ['add']
    });

    expect(Array.isArray(evidence)).toBe(true);
  });

  it('creates patches and performs code review on diffs', async () => {
    const patch = await agent.createPatch('replace "a + b" with "a - b" in index.ts');
    expect(patch).toBeDefined();

    const review = await agent.review('diff --git a/index.ts b/index.ts\n--- a/index.ts\n+++ b/index.ts\n@@ -1,1 +1,1 @@\n-const a = 1;\n+const a = 2;');
    expect(review.summary).toBeDefined();
    expect(Array.isArray(review.findings)).toBe(true);

    // Search files and get symbols
    const files = await agent.searchFiles('index');
    expect(files.length).toBeGreaterThan(0);

    const symbols = await agent.getSymbols('index.ts');
    expect(Array.isArray(symbols)).toBe(true);

    // Structured patch from natural language instruction
    const structPatch = agent.createStructuredPatchFromInstruction('Edit index.ts', true, true);
    expect(structPatch).toBeDefined();

    // Verify native
    const verification = await agent.verifyNative({ run: false });
    expect(verification).toBeDefined();

    // Allocate context
    const allocated = agent.allocateContext({
      modelContextTokens: 8000,
      outputTokens: 500,
      intent: 'feature',
      evidence: [],
      repositorySize: 100
    });
    expect(allocated.tokenBudget).toBe(7500);
  });
});
