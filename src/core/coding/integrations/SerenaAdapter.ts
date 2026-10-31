import fs from 'fs';
import path from 'path';
import { CodingToolConfig, CodingToolError } from './CodingToolConfig';
import { ToolFile, materialize } from './ToolWorkspace';
import { withMcp } from './ToolProcess';

export class SerenaAdapter {
  constructor(private readonly config: CodingToolConfig) {}
  async references(directory: string, files: ToolFile[], file: string, name: string, signal?: AbortSignal) {
    const workspace = materialize(directory, files);
    fs.mkdirSync(path.join(workspace, '.serena'));
    const languageByExtension: Record<string, string> = { '.ts': 'typescript', '.tsx': 'typescript', '.js': 'typescript', '.jsx': 'typescript', '.mjs': 'typescript', '.cjs': 'typescript',
      '.py': 'python', '.pyi': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.cs': 'csharp', '.c': 'cpp', '.cpp': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.gd': 'gdscript' };
    const language = languageByExtension[path.extname(file).toLowerCase()];
    if (!language) throw new CodingToolError('Select a supported source definition file.');
    const languages = [language];
    const generatedConfig = language === 'typescript' && !files.some(item => /(^|\/)(?:tsconfig|jsconfig)\.json$/.test(item.path));
    if (generatedConfig) fs.writeFileSync(path.join(workspace, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'commonjs', allowJs: true, noEmit: true },
      files: files.filter(item => /\.[cm]?[jt]sx?$/.test(item.path)).map(item => item.path),
    }));
    fs.writeFileSync(path.join(workspace, '.serena/project.yml'), JSON.stringify({ project_name: 'chatbot-code-snapshot', languages,
      encoding: 'utf-8', ignore_all_files_in_gitignore: false, ignored_paths: [], read_only: true }));
    return withMcp({ command: this.config.serena, cwd: workspace, timeoutMs: this.config.timeoutMs,
      args: ['start-mcp-server', '--project', workspace, '--context', 'ide', '--agent-interface', 'tools',
        '--enable-web-dashboard', 'false', '--enable-gui-log-window', 'false', '--open-web-dashboard', 'false'] }, async call => {
      const definition = await call('find_symbol', { name_path_pattern: name, relative_path: file, max_matches: 1, max_answer_chars: 16000 });
      const references = await call('find_referencing_symbols', { name_path: name, relative_path: file, max_answer_chars: 24000 });
      return { provider: 'Serena LSP', definition, references, generatedConfig,
        limitations: ['Analysis uses the explicitly selected source snapshot; dependencies and excluded files are not indexed.',
          ...(generatedConfig ? ['No TypeScript/JavaScript project config was selected; a minimal snapshot-only config was generated.'] : [])] };
    }, signal);
  }
}
