import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolCategory, ToolResult } from '../../types/tools';
import { CodeIndexer } from '../agents/CodeIndexer';
import { CommandRunner } from './CommandRunner';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build']);

export function createRepoTools(workspaceRoot: string = process.cwd(), commandRunner = new CommandRunner(workspaceRoot)): Tool[] {
  const indexer = new CodeIndexer(workspaceRoot);

  const safePath = (inputPath: string): string => {
    const absolute = path.resolve(workspaceRoot, inputPath);
    const relative = path.relative(workspaceRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path is outside the workspace: ${inputPath}`);
    }
    return absolute;
  };

  const listFiles = (dir = '.', maxFiles = 200): string[] => {
    const start = safePath(dir);
    const results: string[] = [];
    const walk = (current: string) => {
      if (results.length >= maxFiles) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (results.length >= maxFiles || IGNORED_DIRS.has(entry.name)) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(absolute);
        } else {
          results.push(path.relative(workspaceRoot, absolute).replace(/\\/g, '/'));
        }
      }
    };
    walk(start);
    return results;
  };

  const isTextFile = (file: string): boolean => /\.(ts|tsx|js|jsx|json|md|txt|css|html|yaml|yml|sql)$/i.test(file);

  const runGitDiff = async (): Promise<string> => new Promise(resolve => {
    const child = spawn('git', ['diff', '--', '.'], { cwd: workspaceRoot, shell: false, windowsHide: true });
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
    tool('list_project_files', 'listProjectFiles', 'List source files in the current repository.', [
      { name: 'dir', type: 'string', description: 'Directory to list from', required: false },
      { name: 'maxFiles', type: 'number', description: 'Maximum files to return', required: false }
    ], async params => ({ success: true, data: { files: listFiles(params.dir || '.', params.maxFiles || 200) } })),

    tool('search_repo', 'searchRepo', 'Search repository files for literal text.', [
      { name: 'query', type: 'string', description: 'Text to search for', required: true },
      { name: 'maxResults', type: 'number', description: 'Maximum matches', required: false }
    ], async params => {
      const query = String(params.query || '').toLowerCase();
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const file of listFiles('.', 1000).filter(isTextFile)) {
        if (matches.length >= (params.maxResults || 50)) break;
        const absolute = safePath(file);
        const text = fs.readFileSync(absolute, 'utf8');
        text.split(/\r?\n/).forEach((line, index) => {
          if (matches.length < (params.maxResults || 50) && line.toLowerCase().includes(query)) {
            matches.push({ path: file, line: index + 1, text: line.trim() });
          }
        });
      }
      return { success: true, data: { matches } };
    }),

    tool('read_project_file', 'readProjectFile', 'Read a source file from the current repository by path.', [
      { name: 'path', type: 'string', description: 'Workspace-relative file path', required: true },
      { name: 'maxBytes', type: 'number', description: 'Maximum bytes to return', required: false }
    ], async params => {
      const absolute = safePath(params.path);
      const content = fs.readFileSync(absolute, 'utf8').slice(0, params.maxBytes || 60000);
      return { success: true, data: { path: params.path, content } };
    }),

    tool('get_package_scripts', 'getPackageScripts', 'Read package.json scripts from the repo.', [], async () => {
      const packageJson = JSON.parse(fs.readFileSync(safePath('package.json'), 'utf8'));
      return { success: true, data: { scripts: packageJson.scripts || {} } };
    }),

    tool('git_diff', 'gitDiff', 'Return the current git diff without modifying files.', [], async () => ({
      success: true,
      data: { diff: await runGitDiff() }
    })),

    tool('get_file_symbols', 'getFileSymbols', 'Return AST-like symbols found in a source file.', [
      { name: 'path', type: 'string', description: 'Workspace-relative source file path', required: true }
    ], async params => ({ success: true, data: { symbols: indexer.getFileSymbols(params.path) } })),

    tool('find_references', 'findReferences', 'Find literal references to a symbol in the repo.', [
      { name: 'symbol', type: 'string', description: 'Symbol name', required: true }
    ], async params => {
      const query = String(params.symbol || '').toLowerCase();
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const file of listFiles('.', 1000).filter(isTextFile)) {
        const text = fs.readFileSync(safePath(file), 'utf8');
        text.split(/\r?\n/).forEach((line, index) => {
          if (line.toLowerCase().includes(query)) {
            matches.push({ path: file, line: index + 1, text: line.trim() });
          }
        });
      }
      return { success: true, data: { references: matches.slice(0, 100) } };
    }),

    tool('get_import_graph', 'getImportGraph', 'Return import relationships for repository source files.', [
      { name: 'path', type: 'string', description: 'Optional workspace-relative file path', required: false }
    ], async params => {
      const files = params.path ? [String(params.path)] : listFiles('src', 500).filter(file => /\.(ts|tsx|js|jsx)$/i.test(file));
      const graph = files.map(file => ({
        file,
        imports: fs.readFileSync(safePath(file), 'utf8')
          .split(/\r?\n/)
          .map(line => line.match(/^\s*import\s+.*from\s+['"]([^'"]+)['"]/))
          .filter((match): match is RegExpMatchArray => !!match)
          .map(match => match[1])
      }));
      return { success: true, data: { graph } };
    }),

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
