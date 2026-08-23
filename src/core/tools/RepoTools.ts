import { spawn } from 'child_process';
import { Tool, ToolCategory, ToolResult } from '../../types/tools';
import { CodeIndexer } from '../agents/CodeIndexer';
import { ApprovedRepositoryGateway, RepositoryAccessError } from '../coding/security/ApprovedRepositoryGateway';
import { createArchitectureRepoTools } from './ArchitectureRepoTools';
import { CommandRunner } from './CommandRunner';

export function createRepoTools(
  workspaceRoot: string = process.cwd(),
  commandRunner = new CommandRunner(workspaceRoot),
  repository = new ApprovedRepositoryGateway(workspaceRoot)
): Tool[] {
  const indexer = new CodeIndexer(workspaceRoot, repository);

  const repositoryError = (error: unknown): string => {
    if (error instanceof RepositoryAccessError) return `${error.code}: ${error.message}`;
    if (error instanceof Error) return error.message;
    return 'Repository operation failed.';
  };

  const guarded = async (action: () => ToolResult | Promise<ToolResult>): Promise<ToolResult> => {
    try {
      return await action();
    } catch (error) {
      return { success: false, error: repositoryError(error) };
    }
  };

  const optionalNumber = (value: unknown): number | undefined => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const runGitDiff = async (): Promise<string> => new Promise(resolve => {
    const child = spawn('git', ['diff', '--', '.'], { cwd: repository.approvedRoot, shell: false, windowsHide: true });
    let stdout = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.on('close', () => resolve(stdout));
    child.on('error', () => resolve(''));
  });

  const tool = (
    id: string,
    name: string,
    description: string,
    parameters: Tool['parameters'],
    execute: (params: Record<string, any>) => Promise<ToolResult>
  ): Tool => ({ id, name, description, category: ToolCategory.CODING, parameters, execute });

  return [
    ...createArchitectureRepoTools(workspaceRoot, repository),
    tool('list_project_files', 'listProjectFiles', 'List source files inside the approved repository.', [
      { name: 'dir', type: 'string', description: 'Repository-relative directory', required: false },
      { name: 'maxFiles', type: 'number', description: 'Maximum files to return', required: false }
    ], async params => guarded(() => {
      const files = repository.listFiles(String(params.dir || '.'), optionalNumber(params.maxFiles) || 200);
      return { success: true, data: { files } };
    })),

    tool('search_repo', 'searchRepo', 'Search approved repository text files for literal text.', [
      { name: 'query', type: 'string', description: 'Text to search for', required: true },
      { name: 'maxResults', type: 'number', description: 'Maximum matches', required: false }
    ], async params => guarded(() => {
      const result = repository.searchText(String(params.query || ''), {
        maxResults: optionalNumber(params.maxResults),
        maxFiles: 1000
      });
      return { success: true, data: result };
    })),

    tool('read_project_file', 'readProjectFile', 'Read a bounded text file from the approved repository.', [
      { name: 'path', type: 'string', description: 'Repository-relative file path', required: true },
      { name: 'maxBytes', type: 'number', description: 'Maximum bytes to return', required: false }
    ], async params => guarded(() => ({
      success: true,
      data: repository.readTextFile(String(params.path || ''), optionalNumber(params.maxBytes))
    }))),

    tool('get_package_scripts', 'getPackageScripts', 'Read package.json scripts from the approved repository.', [], async () => guarded(() => {
      const packageJson = JSON.parse(repository.readTextFile('package.json').content);
      return { success: true, data: { scripts: packageJson.scripts || {} } };
    })),

    tool('git_diff', 'gitDiff', 'Return the current git diff without modifying files.', [], async () => ({
      success: true,
      data: { diff: await runGitDiff() }
    })),

    tool('get_file_symbols', 'getFileSymbols', 'Return AST-like symbols found in an approved source file.', [
      { name: 'path', type: 'string', description: 'Repository-relative source file path', required: true }
    ], async params => guarded(() => ({
      success: true,
      data: { symbols: indexer.getFileSymbols(String(params.path || '')) }
    }))),

    tool('find_references', 'findReferences', 'Find literal references to a symbol in approved repository text files.', [
      { name: 'symbol', type: 'string', description: 'Symbol name', required: true }
    ], async params => guarded(() => {
      const result = repository.searchText(String(params.symbol || ''), { maxResults: 100, maxFiles: 1000 });
      return {
        success: true,
        data: {
          references: result.matches,
          scannedFiles: result.scannedFiles,
          skippedFiles: result.skippedFiles,
          truncated: result.truncated
        }
      };
    })),

    tool('get_import_graph', 'getImportGraph', 'Return import relationships for approved JavaScript and TypeScript files.', [
      { name: 'path', type: 'string', description: 'Optional repository-relative file path', required: false }
    ], async params => guarded(() => {
      const files = params.path
        ? [repository.readTextFile(String(params.path)).path]
        : repository.listFiles('.', 1000).filter(file => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
      const graph = files.map(file => {
        const source = repository.readTextFile(file);
        return {
          file,
          truncated: source.truncated,
          imports: source.content
            .split(/\r?\n/)
            .map(line => line.match(/^\s*import\s+.*from\s+['"]([^'"]+)['"]/))
            .filter((match): match is RegExpMatchArray => Boolean(match))
            .map(match => match[1])
        };
      });
      return { success: true, data: { graph } };
    })),

    tool('run_command', 'runCommand', 'Run an allowlisted repository command.', [
      { name: 'command', type: 'string', description: 'Allowlisted command to run', required: true }
    ], async params => {
      const result = await commandRunner.run(params.command);
      return { success: result.success, data: result, error: result.error };
    }),

    tool('run_tests', 'runTests', 'Run the allowlisted project test command.', [
      { name: 'command', type: 'string', description: 'Optional allowlisted test command', required: false }
    ], async params => {
      const result = await commandRunner.run(params.command || 'npm test -- --runInBand');
      return { success: result.success, data: result, error: result.error };
    }),

    tool('create_patch', 'createPatch', 'Package a proposed unified diff without applying it.', [
      { name: 'diff', type: 'string', description: 'Unified diff content', required: true }
    ], async params => ({
      success: true,
      data: {
        format: 'unified-diff',
        diff: String(params.diff || ''),
        applyEnabled: process.env.ENABLE_AGENT_PATCH_APPLY === 'true'
      }
    })),

    tool('apply_patch', 'applyPatch', 'Apply a unified diff only when agent patch apply is explicitly enabled.', [
      { name: 'diff', type: 'string', description: 'Unified diff content', required: true }
    ], async () => {
      if (process.env.ENABLE_AGENT_PATCH_APPLY !== 'true') {
        return {
          success: false,
          error: 'Patch application is disabled. Set ENABLE_AGENT_PATCH_APPLY=true to allow this tool.'
        };
      }
      return {
        success: false,
        error: 'Patch application requires the host apply_patch facility and is not available through repo tools.'
      };
    })
  ];
}
