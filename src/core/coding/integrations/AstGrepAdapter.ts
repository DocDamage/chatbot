import path from 'path';
import { CodingToolConfig, CodingToolError } from './CodingToolConfig';
import { ToolFile, materialize } from './ToolWorkspace';
import { runTool } from './ToolProcess';
import { EditOperation } from '../types';

export class AstGrepAdapter {
  constructor(private readonly config: CodingToolConfig) {}
  async search(directory: string, files: ToolFile[], pattern: string, language: string, rewrite?: string, signal?: AbortSignal) {
    if (!pattern.trim() || pattern.length > 4000 || (rewrite?.length || 0) > 8000) throw new CodingToolError('A bounded structural pattern is required.');
    if (!['typescript', 'tsx', 'javascript', 'jsx', 'python', 'rust', 'go', 'java', 'c', 'cpp', 'csharp'].includes(language)) throw new CodingToolError('Unsupported structural search language.');
    const workspace = materialize(directory, files);
    const args = ['run', '--pattern', pattern, '--lang', language, '--json=compact'];
    if (rewrite !== undefined) args.push('--rewrite', rewrite);
    args.push(...files.map(file => path.join(workspace, file.path)));
    const result = await runTool(this.config.astGrep, args, workspace, Math.min(this.config.timeoutMs, 30000), undefined, signal);
    if (result.exitCode !== 0 && result.exitCode !== 1) throw new CodingToolError(result.stderr || 'ast-grep failed.', 502);
    let matches: any[];
    try { matches = result.stdout.trim() ? JSON.parse(result.stdout) : []; } catch { throw new CodingToolError('ast-grep returned invalid structured output.', 502); }
    const operations: EditOperation[] = [];
    if (rewrite !== undefined) for (const file of files) {
      const patches = matches.filter(match => path.resolve(match.file) === path.join(workspace, file.path) && typeof match.replacement === 'string').sort((a, b) => b.range.byteOffset.start - a.range.byteOffset.start);
      if (!patches.length) continue;
      let buffer = Buffer.from(file.content), lastStart = buffer.length;
      for (const match of patches) {
        const { start, end } = match.range.byteOffset;
        if (end > lastStart || start < 0 || end < start) throw new CodingToolError('Overlapping structural edits require a narrower pattern.');
        buffer = Buffer.concat([buffer.subarray(0, start), Buffer.from(match.replacement), buffer.subarray(end)]); lastStart = start;
      }
      operations.push({ operation: 'modify', path: file.path, content: buffer.toString('utf8'), expectedContent: file.content, expectedHash: file.sha256, reason: 'ast-grep structural rewrite preview', authorized: false });
    }
    return { provider: 'ast-grep', matches: matches.map(match => ({ ...match, file: path.relative(workspace, match.file).replace(/\\/g, '/') })), operations };
  }
}
