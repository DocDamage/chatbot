import { CodingAgent } from './CodingAgent';
import { LLMAdapter } from '../providers/LLMAdapter';

describe('CodingAgent', () => {
  it('classifies coding intents beyond simple keyword checks', () => {
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });

    expect(agent.classifyIntent('review this diff for security bugs')).toBe('review_diff');
    expect(agent.classifyIntent('why is this stack trace failing?')).toBe('debug_error');
    expect(agent.classifyIntent('add tests for the rag route')).toBe('generate_tests');
  });

  it('inspects repo files before returning a coding answer', async () => {
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });

    const result = await agent.handle({
      message: 'Where is the enhanced orchestrator implemented?'
    });

    expect(result.filesInspected.length).toBeGreaterThan(0);
    expect(result.summary).toContain('EnhancedOrchestrator');
    expect(result.patch.format).toBe('unified-diff');
    expect(result.verification.status).toBe('not_run');
  });

  it('records tool evidence and builds code context in priority order', async () => {
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });

    const result = await agent.handle({
      message: 'Explain where EnhancedOrchestrator routes code tasks'
    });

    expect(result.toolCalls.map(call => call.toolId)).toEqual(expect.arrayContaining([
      'search_repo',
      'read_project_file',
      'get_package_scripts',
      'git_diff'
    ]));
    expect(result.context.items[0].kind).toBe('user_request');
    expect(result.context.items.some(item => item.kind === 'source_file')).toBe(true);
    expect(result.context.tokenBudget).toBeGreaterThan(0);
  });

  it('turns valid provider JSON into a reviewable, unauthorized structured patch', async () => {
    const adapter: LLMAdapter = {
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({ operations: [{ operation: 'create', path: 'generated.ts', content: 'export const ready = true;\n', reason: 'Add the requested module', authorized: true }] }),
        model: 'test-coder'
      }),
      estimateCost: () => 0,
      getModelName: () => 'test-coder'
    };
    const agent = new CodingAgent({ workspaceRoot: process.cwd() });
    const result = await agent.handle({ message: 'create generated.ts', modelAdapter: adapter, model: 'test-coder', generatePatch: true });

    expect(adapter.generate).toHaveBeenCalled();
    expect(result.patch.filesChanged).toEqual(['generated.ts']);
    expect(result.patch.diff).toContain('generated.ts');
    expect(result.patch.explanation).toContain('Structured patch');
  });

  it('reports malformed provider output without creating a patch', async () => {
    const adapter: LLMAdapter = {
      generate: jest.fn().mockResolvedValue({ content: 'not structured output', model: 'test-coder' }),
      estimateCost: () => 0,
      getModelName: () => 'test-coder'
    };
    const result = await new CodingAgent({ workspaceRoot: process.cwd() }).handle({ message: 'implement the fix', modelAdapter: adapter, generatePatch: true });

    expect(result.patch.filesChanged).toEqual([]);
    expect(result.risks).toContain('Model output was not valid structured patch JSON; no patch was created');
  });
});
