import { CodingAgent } from './CodingAgent';

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
});
