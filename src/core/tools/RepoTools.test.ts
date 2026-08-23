import { FunctionCaller } from './FunctionCaller';
import { createRepoTools } from './RepoTools';
import { ToolRegistry } from './ToolRegistry';

describe('RepoTools', () => {
  function callerForRepo() {
    const registry = new ToolRegistry();
    for (const tool of createRepoTools(process.cwd())) registry.register(tool);
    return new FunctionCaller(registry);
  }

  it('registers the common repo-aware coding tools', () => {
    const ids = createRepoTools(process.cwd()).map(tool => tool.id);
    expect(ids).toEqual(expect.arrayContaining([
      'get_repository_architecture',
      'query_repository_architecture',
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
});
