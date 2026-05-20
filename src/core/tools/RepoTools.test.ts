import { FunctionCaller } from './FunctionCaller';
import { createRepoTools } from './RepoTools';
import { ToolRegistry } from './ToolRegistry';

describe('RepoTools', () => {
  function callerForRepo() {
    const registry = new ToolRegistry();
    for (const tool of createRepoTools(process.cwd())) {
      registry.register(tool);
    }
    return new FunctionCaller(registry);
  }

  it('reads files only from inside the project workspace', async () => {
    const caller = callerForRepo();

    const allowed = await caller.execute({
      toolId: 'read_project_file',
      parameters: { path: 'package.json' }
    });
    const blocked = await caller.execute({
      toolId: 'read_project_file',
      parameters: { path: '../package.json' }
    });

    expect(allowed.success).toBe(true);
    expect(allowed.data.content).toContain('"scripts"');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('outside the workspace');
  });

  it('exposes package scripts and a git diff tool', async () => {
    const caller = callerForRepo();

    const scripts = await caller.execute({
      toolId: 'get_package_scripts',
      parameters: {}
    });
    const diff = await caller.execute({
      toolId: 'git_diff',
      parameters: {}
    });

    expect(scripts.success).toBe(true);
    expect(scripts.data.scripts).toHaveProperty('type-check');
    expect(diff.success).toBe(true);
    expect(typeof diff.data.diff).toBe('string');
  });

  it('registers the common repo-aware coding tools', () => {
    const ids = createRepoTools(process.cwd()).map(tool => tool.id);

    expect(ids).toEqual(expect.arrayContaining([
      'search_repo',
      'read_project_file',
      'get_file_symbols',
      'find_references',
      'get_import_graph',
      'run_tests',
      'create_patch',
      'apply_patch',
      'git_diff'
    ]));
  });

  it('indexes symbols from a TypeScript file', async () => {
    const caller = callerForRepo();

    const result = await caller.execute({
      toolId: 'get_file_symbols',
      parameters: { path: 'src/core/orchestrator/EnhancedOrchestrator.ts' }
    });

    expect(result.success).toBe(true);
    expect(result.data.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'EnhancedOrchestrator' })
      ])
    );
  });
});
