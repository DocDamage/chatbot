import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { codingToolConfig, CodingToolConfig, CodingToolError } from './CodingToolConfig';
import { captureFiles, captureNewFiles } from './ToolWorkspace';
import { SerenaAdapter } from './SerenaAdapter';
import { AstGrepAdapter } from './AstGrepAdapter';
import { Context7Adapter } from './Context7Adapter';
import { AiderAdapter } from './AiderAdapter';
import { StructuredEditEngine } from '../editing/StructuredEditEngine';
import { selectAutomaticContext } from './AutomaticContext';
import { validatePatchDraft } from './PatchDraftValidator';

export class CodingToolsService {
  private readonly active = new Set<AbortController>();
  private aiderBusy = false;
  private stopped = false;
  constructor(readonly workspaceRoot = process.cwd(), readonly config: CodingToolConfig = codingToolConfig()) {}
  status() {
    const tools = { serena: fs.existsSync(this.config.serena), aider: fs.existsSync(this.config.aiderPython),
      astGrep: fs.existsSync(this.config.astGrep), context7: fs.existsSync(this.config.context7),
      eslint: fs.existsSync(path.join(this.config.root, 'services/coding-tools/node_modules/eslint/package.json')) };
    return { enabled: !this.stopped && this.config.enabled, installed: tools, model: this.config.model, workspaceRoot: this.workspaceRoot,
      context7KeyConfigured: Boolean(process.env.CONTEXT7_API_KEY), aiderBusy: this.aiderBusy,
      limitations: ['Serena and ast-grep inspect selected source snapshots.', 'Aider uses local Ollama and proposes edits; it does not apply them to the repository.',
        'Context7 documentation queries use its external service. Never include secrets or private source in documentation questions.'] };
  }
  private async run<T>(owner: string, tool: string, work: (directory: string, signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T & { runId: string }> {
    if (this.stopped || !this.config.enabled) throw new CodingToolError('Coding tools are disabled. Run npm run setup:coding-tools and restart.', 503);
    if (!owner) throw new CodingToolError('Authentication is required.', 401);
    const controller = new AbortController(); this.active.add(controller);
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    const id = crypto.randomUUID(), directory = path.join(this.config.dataRoot, id);
    fs.mkdirSync(directory, { recursive: true });
    const record = { id, owner, tool, startedAt: new Date().toISOString() };
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.config.timeoutMs);
    try {
      if (signal?.aborted) controller.abort();
      const result = await work(directory, controller.signal);
      if (controller.signal.aborted) throw new CodingToolError('Coding tool cancelled.', 409);
      fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ ...record, status: 'completed', result }, null, 2));
      return { ...result, runId: id };
    } catch (error: any) {
      const failure = timedOut ? new CodingToolError('Coding tool exceeded its total time budget.', 504, 'CODING_TOOL_TIMEOUT') : error;
      fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ ...record, status: controller.signal.aborted ? 'cancelled' : 'failed', error: failure.message })); throw failure;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); this.active.delete(controller); }
  }
  references(owner: string, input: { files: string[]; file: string; symbol: string }, signal?: AbortSignal) {
    if (!input.symbol?.trim() || input.symbol.length > 200 || !input.files.includes(input.file)) throw new CodingToolError('Select the definition file and a bounded symbol name.');
    const files = captureFiles(this.workspaceRoot, input.files, 512 * 1024, 64);
    return this.run(owner, 'serena', (directory, abort) => new SerenaAdapter(this.config).references(directory, files, input.file, input.symbol, abort), signal);
  }
  structural(owner: string, input: { files: string[]; pattern: string; language: string; rewrite?: string }, signal?: AbortSignal) {
    const files = captureFiles(this.workspaceRoot, input.files);
    return this.run(owner, 'ast-grep', async (directory, abort) => {
      const result = await new AstGrepAdapter(this.config).search(directory, files, input.pattern, input.language, input.rewrite, abort);
      const checks = result.operations.length ? await validatePatchDraft(this.config, this.workspaceRoot, files, result.operations, abort) : undefined;
      const patch = new StructuredEditEngine(this.workspaceRoot).createPatch(result.operations, { requireAuthorization: false });
      if (checks?.errors.length) patch.conflicts.push(...checks.errors.map(reason => ({ path: '(static checks)', reason })));
      return { ...result, draftChecks: checks ? { status: checks.errors.length ? 'failed' : 'passed', ...checks } : undefined, patch };
    }, signal);
  }
  documentation(owner: string, query: string, library: string, signal?: AbortSignal) {
    return this.run(owner, 'context7', (_directory, abort) => new Context7Adapter(this.config).query(query, library, abort), signal);
  }
  async propose(owner: string, input: { files: string[]; newFiles?: string[]; message: string; automaticContext?: boolean; propertyTests?: boolean; documentation?: { library: string; query: string } }, signal?: AbortSignal) {
    if (this.aiderBusy) throw new CodingToolError('A coding worker is already using Ollama. Wait or cancel it first.', 409);
    this.aiderBusy = true;
    try {
      return await this.run(owner, 'aider', async (directory, abort) => {
        const selection = selectAutomaticContext(this.workspaceRoot, input.files.length ? captureFiles(this.workspaceRoot, input.files, 16000, 12) : [],
          captureNewFiles(this.workspaceRoot, input.newFiles), input.message, input.automaticContext !== false);
        const docs = input.documentation ? await new Context7Adapter(this.config).query(input.documentation.query, input.documentation.library, abort) : undefined;
        const result = await new AiderAdapter(this.config).propose(directory, selection.editable, input.message, docs?.content, abort,
          { repositoryRoot: this.workspaceRoot, readOnly: selection.readOnly, propertyTests: input.propertyTests });
        return { ...result, selection: { files: selection.summary, scannedFiles: selection.scannedFiles, scannedBytes: selection.scannedBytes, omitted: selection.omitted, limitations: selection.limitations },
          documentation: docs, patch: new StructuredEditEngine(this.workspaceRoot).createPatch(result.operations, { requireAuthorization: false }) };
      }, signal);
    } finally { this.aiderBusy = false; }
  }
  shutdown(): void { this.stopped = true; for (const controller of this.active) controller.abort(); }
}
