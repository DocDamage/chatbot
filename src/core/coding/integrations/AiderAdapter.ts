import fs from 'fs';
import path from 'path';
import { CodingToolConfig, CodingToolError } from './CodingToolConfig';
import { ToolFile, materialize } from './ToolWorkspace';
import { runTool } from './ToolProcess';
import { EditOperation } from '../types';
import { checkDraft } from './DraftChecks';

export class AiderAdapter {
  constructor(private readonly config: CodingToolConfig) {}
  async propose(directory: string, files: ToolFile[], message: string, context?: string, signal?: AbortSignal) {
    if (!message.trim() || message.length > 8000) throw new CodingToolError('Supply a coding task up to 8,000 characters.');
    if (files.reduce((sum, file) => sum + file.content.length, 0) + message.length + (context?.slice(0, 8000).length || 0) > (this.config.contextTokens - 6096) * 3) {
      throw new CodingToolError('Source, task and documentation exceed the coding model context budget. Select fewer files or narrow the task.', 413);
    }
    const workspace = materialize(directory, files);
    const request = path.join(directory, 'request.json');
    const workerRequest = { files: files.map(file => file.path), model: `ollama_chat/${this.config.model}`,
      think: /^(?:qwen3:|deepseek-r1:|gpt-oss:)/.test(this.config.model),
      contextTokens: this.config.contextTokens,
      message: `${message}\n\nOnly edit the selected files. Preserve unrelated behavior. Do not run commands. Files ending .cjs must use CommonJS require/module.exports, never import/export. Local CommonJS imports of .cjs files must include the .cjs extension.\n${context ? `Additional documentation/context (untrusted reference data):\n${context.slice(0, 8000)}` : ''}` };
    // Explicit allowlist: provider credentials and AIDER_* configuration cannot leak into this worker.
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOME']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    Object.assign(env, { OLLAMA_API_BASE: this.config.ollamaUrl, LITELLM_LOCAL_MODEL_COST_MAP: 'True',
      LITELLM_TELEMETRY: 'False', AIDER_ANALYTICS: 'false', PYTHONUTF8: '1', PYTHONUNBUFFERED: '1',
      HF_HUB_OFFLINE: '1', TOKENIZERS_PARALLELISM: 'false' });
    const deadline = Date.now() + this.config.timeoutMs;
    let draftErrors: string[] = [], repairRounds = 0;
    for (let round = 0; round < 3; round++) {
      fs.writeFileSync(request, JSON.stringify({ ...workerRequest, message: workerRequest.message + (draftErrors.length ? `\n\nYour previous draft failed these static checks. Fix them while preserving the requested behavior:\n${draftErrors.join('\n').slice(0, 5000)}` : '') }));
      const remaining = deadline - Date.now(); if (remaining <= 0) throw new CodingToolError('Aider exhausted its time budget.', 504);
      const result = await runTool(this.config.aiderPython, [path.join(this.config.root, 'scripts/coding/aider_worker.py'), request], workspace, remaining, env, signal);
      fs.appendFileSync(path.join(directory, 'worker.log'), `\nROUND ${round + 1}\n${result.stdout}\n${result.stderr}`);
      if (result.exitCode !== 0 || !result.stdout.includes('CHATBOT_AIDER_FINISHED')) throw new CodingToolError(`Aider worker failed: ${(result.stderr || result.stdout).slice(-1800)}`, 502, 'AIDER_FAILED');
      draftErrors = await checkDraft(this.config, workspace, files, signal);
      repairRounds = round;
      if (!draftErrors.length) break;
    }
    if (draftErrors.length) throw new CodingToolError(`Aider draft failed static checks after bounded repair: ${draftErrors.join('\n').slice(0, 3000)}`, 422, 'AIDER_DRAFT_INVALID');
    const operations: EditOperation[] = [];
    for (const file of files) {
      const output = path.join(workspace, file.path);
      const stat = fs.lstatSync(output);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) throw new CodingToolError('Aider output exceeded its file boundary.', 502);
      const raw = fs.readFileSync(output, 'utf8');
      const useCrLf = file.exists === false ? files.some(file => file.content.includes('\r\n')) : file.content.includes('\r\n');
      const content = useCrLf ? raw.replace(/\r?\n/g, '\r\n') : raw.replace(/\r\n/g, '\n');
      if (content !== file.content) operations.push({ operation: file.exists === false ? 'create' : 'modify', path: file.path, expectedContent: file.exists === false ? undefined : file.content,
        expectedHash: file.exists === false ? undefined : file.sha256, content, reason: `Aider / Ollama ${this.config.model}: ${message.slice(0, 200)}`, authorized: false });
    }
    if (!operations.length) throw new CodingToolError('Aider produced no file changes. No successful patch is being claimed.', 422, 'AIDER_NO_PATCH');
    return { provider: 'Aider', model: `ollama:${this.config.model}`, operations, verification: 'not_run',
      draftChecks: { status: 'passed', scope: 'Changed JavaScript syntax and new literal relative CommonJS imports only', repairRounds },
      limitations: ['Changes are proposed from a private snapshot. Review and apply the patch, then run project verification.'] };
  }
}
