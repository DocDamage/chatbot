import * as fs from 'fs';
import * as path from 'path';
import { FunctionCaller } from '../tools/FunctionCaller';
import { ToolCall } from '../../types/tools';
import { ToolRegistry } from '../tools/ToolRegistry';
import { createRepoTools } from '../tools/RepoTools';
import { CommandRunner } from '../tools/CommandRunner';
import { CodeIndexer, CodeSymbol } from './CodeIndexer';
import { CodePlanner, CodingIntent, CodePlan } from './CodePlanner';
import { CodeReviewer, CodeReviewResult } from './CodeReviewer';
import { PatchGenerator, GeneratedPatch } from './PatchGenerator';
import { VerificationRunner, VerificationSummary } from './VerificationRunner';
import { CodeContext, CodeContextBudgeter } from './CodeContextBudgeter';
import { ChatContextBundle, renderChatContext } from '../../types/chat';
import { RepositoryIntelligence, RepositorySnapshot } from '../coding/repository/RepositoryIntelligence';
import { SymbolIndex } from '../coding/index/SymbolIndex';
import { StructuralRetriever } from '../coding/retrieval/StructuralRetriever';
import { AdaptiveContextAllocator, AllocatedContext } from '../coding/retrieval/AdaptiveContextAllocator';
import { StructuredEditEngine } from '../coding/editing/StructuredEditEngine';
import { EditOperation, ContextEvidence, StructuredPatch } from '../coding/types';
import { VerificationOrchestrator, VerificationSummary as NativeVerificationSummary } from '../coding/verification/VerificationOrchestrator';
import { WorkspaceWriteGate } from '../coding/editing/WorkspaceWriteGate';
import { WorkMode } from '../modes/ExecutionModePolicy';
import { LLMAdapter } from '../providers/LLMAdapter';
import { RepairRun } from '../coding/verification/RepairController';
import { isSensitiveWorkspacePath } from '../coding/security/WorkspacePathPolicy';
import { ApprovedRepositoryGateway } from '../coding/security/ApprovedRepositoryGateway';
import { GatewayLexicalRetrievalProvider } from '../coding/retrieval/GatewayLexicalRetrievalProvider';
import { HybridRepositoryRetriever } from '../coding/retrieval/HybridRepositoryRetriever';

export interface CodingAgentConfig {
  workspaceRoot?: string;
  modelContextTokens?: number;
  toolRegistry?: ToolRegistry;
  functionCaller?: FunctionCaller;
  verificationRunner?: VerificationRunner;
}

export interface CodingAgentRequest {
  message: string;
  runVerification?: boolean;
  context?: ChatContextBundle;
  modelAdapter?: LLMAdapter;
  model?: string;
  generatePatch?: boolean;
}

export interface CodingAgentResult {
  intent: CodingIntent;
  summary: string;
  filesInspected: string[];
  plan: CodePlan;
  patch: GeneratedPatch;
  structuredPatch?: StructuredPatch;
  commandsRun: string[];
  verification: VerificationSummary;
  review: CodeReviewResult;
  toolCalls: ToolCall[];
  context: CodeContext;
  adaptiveContext?: AllocatedContext;
  risks: string[];
  nextStep?: string;
}

export class CodingAgent {
  private readonly workspaceRoot: string;
  private readonly planner = new CodePlanner();
  private readonly reviewer = new CodeReviewer();
  private readonly patchGenerator = new PatchGenerator();
  private readonly contextBudgeter: CodeContextBudgeter;
  private readonly indexer: CodeIndexer;
  private readonly functionCaller: FunctionCaller;
  private readonly verificationRunner: VerificationRunner;
  private readonly repositoryIntelligence: RepositoryIntelligence;
  private readonly symbolIndex: SymbolIndex;
  private readonly editEngine: StructuredEditEngine;
  private readonly writeGate = new WorkspaceWriteGate();
  private readonly nativeVerification: VerificationOrchestrator;
  private readonly lexicalRetriever: GatewayLexicalRetrievalProvider;
  private readonly hybridRetriever: HybridRepositoryRetriever;

  constructor(config: CodingAgentConfig = {}) {
    this.workspaceRoot = config.workspaceRoot || process.cwd();
    this.contextBudgeter = new CodeContextBudgeter(config.modelContextTokens || Number(process.env.CODING_MODEL_CONTEXT_TOKENS || 12000));
    this.indexer = new CodeIndexer(this.workspaceRoot);

    const registry = config.toolRegistry || new ToolRegistry();
    if (!config.toolRegistry) {
      for (const tool of createRepoTools(this.workspaceRoot)) {
        registry.register(tool);
      }
    }
    this.functionCaller = config.functionCaller || new FunctionCaller(registry);
    this.verificationRunner = config.verificationRunner || new VerificationRunner(new CommandRunner(this.workspaceRoot));
    this.repositoryIntelligence = new RepositoryIntelligence(this.workspaceRoot);
    this.symbolIndex = new SymbolIndex(this.workspaceRoot);
    this.editEngine = new StructuredEditEngine(this.workspaceRoot);
    this.nativeVerification = new VerificationOrchestrator(this.workspaceRoot);
    this.lexicalRetriever = new GatewayLexicalRetrievalProvider(new ApprovedRepositoryGateway(this.workspaceRoot));
    this.hybridRetriever = new HybridRepositoryRetriever(this.lexicalRetriever);
  }

  classifyIntent(message: string): CodingIntent {
    return this.planner.classifyIntent(message);
  }

  async handle(request: CodingAgentRequest): Promise<CodingAgentResult> {
    const contextualMessage = this.messageWithContext(request.message, request.context);
    const plan = this.planner.createPlan(contextualMessage);
    const evidence = await this.gatherEvidence(request.message);
    const filesInspected = evidence.filesInspected;
    const context = this.contextBudgeter.build({
      userRequest: contextualMessage,
      fileExcerpts: evidence.fileExcerpts,
      relatedTests: evidence.relatedTests,
      packageScripts: evidence.packageScripts,
      architectureNotes: evidence.architectureNotes
    });
    const adaptiveContext = new AdaptiveContextAllocator().allocate({
      modelContextTokens: context.tokenBudget,
      outputTokens: Math.max(256, Math.ceil(contextualMessage.length / 4)),
      intent: plan.intent,
      repositorySize: evidence.filesInspected.length,
      evidence: [
        { kind: 'request', label: 'User request', content: contextualMessage, authority: 'user', reason: 'user task', confidence: 1 },
        ...evidence.fileExcerpts.map(file => ({ kind: 'source' as const, label: file.path, content: file.content, path: file.path, authority: 'repository' as const, reason: 'inspected implementation', confidence: 0.9 })),
        ...evidence.relatedTests.map(file => ({ kind: 'test' as const, label: file.path, content: file.content, path: file.path, authority: 'repository' as const, reason: 'related test', confidence: 0.85 })),
        ...evidence.architectureNotes.map((note, index) => ({ kind: 'architecture' as const, label: `architecture-${index + 1}`, content: note, authority: 'repository' as const, reason: 'repository architecture note', confidence: 0.8 }))
      ]
    });
    const summary = this.summarizeFromEvidence(contextualMessage, filesInspected, evidence);
    const modelPatch = request.generatePatch && request.modelAdapter
      ? await this.generateModelPatch(request.modelAdapter, request.model, contextualMessage, adaptiveContext)
      : undefined;
    const patch = modelPatch?.patch || this.patchGenerator.createEmptyPatch();
    const verification = request.runVerification
      ? await this.verificationRunner.runStandardSuite()
      : { status: 'not_run' as const, commandsRun: [], results: [], remainingRisks: ['Verification was not requested'] };
    const review = this.reviewer.review(patch.diff);
    const risks = [...verification.remainingRisks, ...(modelPatch?.risks || [])];

    return {
      intent: plan.intent,
      summary,
      filesInspected,
      plan,
      patch,
      structuredPatch: modelPatch?.structuredPatch,
      commandsRun: verification.commandsRun,
      verification,
      review,
      toolCalls: evidence.toolCalls,
      context,
      adaptiveContext,
      risks,
      nextStep: request.runVerification ? undefined : 'Run /api/code/verify before trusting behavior-changing code.'
    };
  }

  async plan(message: string): Promise<CodePlan> {
    return this.planner.createPlan(message);
  }

  async createPatch(message: string): Promise<GeneratedPatch> {
    return this.patchGenerator.createPatchFromInstruction(message, this.workspaceRoot);
  }

  async verify(commands: string[] = ['npm run type-check']): Promise<VerificationSummary> {
    return this.verificationRunner.runCommands(commands);
  }

  async review(diff: string, focus: string[] = []): Promise<CodeReviewResult> {
    return this.reviewer.review(diff, focus);
  }

  getRepositorySnapshot(): RepositorySnapshot {
    return this.repositoryIntelligence.snapshot();
  }

  async retrieveEvidence(request: { query: string; files?: string[]; symbols?: string[]; diagnostics?: Array<{ file?: string; message: string }>; maxItems?: number }): Promise<ContextEvidence[]> {
    const snapshot = this.getRepositorySnapshot();
    this.symbolIndex.indexFiles(snapshot.files.filter(file => !file.binary).map(file => file.path));
    const structural = new StructuralRetriever(this.workspaceRoot, snapshot, this.symbolIndex).retrieve(request);
    await this.lexicalRetriever.update({ repositoryVersion: snapshot.version });
    const hybrid = await this.hybridRetriever.search({
      query: request.query,
      repositoryVersion: snapshot.version,
      symbols: request.symbols,
      diagnostics: request.diagnostics?.flatMap(value => [value.file || '', value.message]),
      maxResults: request.maxItems,
      structural: structural.filter(value => value.path).map(value => ({
        path: value.path!, lineStart: value.line, lineEnd: value.line, score: value.confidence, reason: value.reason
      }))
    });
    const seen = new Set<string>();
    return hybrid.results.filter(value => {
      const key = `${value.path}\\0${value.lineStart}\\0${value.lineEnd}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(value => ({
      kind: 'source' as const,
      label: value.path,
      content: value.excerpt,
      path: value.path,
      line: value.lineStart,
      authority: 'repository' as const,
      reason: value.reasons.join('; '),
      confidence: Math.min(1, value.scores.final / 5)
    }));
  }

  createStructuredPatch(operations: EditOperation[]): StructuredPatch {
    return this.editEngine.createPatch(operations);
  }

  createStructuredPatchFromInstruction(message: string, authorized = false, reviewOnly = false): StructuredPatch {
    return this.editEngine.fromNaturalLanguage(message, { authorized, requireAuthorization: !reviewOnly });
  }

  applyStructuredPatch(patch: StructuredPatch, mode: WorkMode): StructuredPatch {
    this.writeGate.assertCanApply(mode, patch);
    return this.editEngine.apply(patch);
  }

  async verifyNative(options: { run?: boolean; maxCommands?: number } = {}): Promise<NativeVerificationSummary> {
    return this.nativeVerification.verify(options);
  }

  async repair(options: { operations: EditOperation[]; mode: WorkMode; maxIterations?: number }): Promise<RepairRun> {
    return this.nativeVerification.verifyWithRepair({
      propose: async (diagnostics, iteration) => iteration === 1 && diagnostics.length > 0
        ? { hypothesis: `Apply the approved repair proposal after ${diagnostics.length} diagnostic(s).`, operations: options.operations }
        : undefined,
      apply: async operations => {
        const patch = this.createStructuredPatch(operations.map(operation => ({ ...operation, authorized: true })));
        this.applyStructuredPatch(patch, options.mode);
      }
    }, { maxIterations: options.maxIterations });
  }

  allocateContext(input: { modelContextTokens: number; outputTokens: number; intent: string; evidence: ContextEvidence[]; repositorySize: number; errorCount?: number }) {
    return new AdaptiveContextAllocator().allocate(input);
  }

  async searchFiles(query: string): Promise<Array<{ path: string }>> {
    const lower = query.toLowerCase();
    return this.listFiles('.', 500)
      .filter(file => file.toLowerCase().includes(lower))
      .slice(0, 50)
      .map(file => ({ path: file }));
  }

  async getSymbols(file: string): Promise<CodeSymbol[]> {
    return this.indexer.getFileSymbols(file);
  }

  private async gatherEvidence(message: string): Promise<{
    filesInspected: string[];
    fileExcerpts: Array<{ path: string; content: string }>;
    relatedTests: Array<{ path: string; content: string }>;
    packageScripts: Record<string, string>;
    architectureNotes: string[];
    toolCalls: ToolCall[];
  }> {
    const toolCalls: ToolCall[] = [];

    const execute = async (call: ToolCall) => {
      call.result = await this.functionCaller.execute(call);
      toolCalls.push(call);
      return call.result;
    };

    await execute({
      toolId: 'search_repo',
      parameters: { query: this.primarySearchTerm(message), maxResults: 20 }
    });

    const scriptsResult = await execute({
      toolId: 'get_package_scripts',
      parameters: {}
    });

    await execute({
      toolId: 'git_diff',
      parameters: {}
    });

    const lower = message.toLowerCase();
    const structuralEvidence = await this.retrieveEvidence({ query: message, maxItems: 24 });
    const structurallySelected = structuralEvidence
      .map(item => item.path)
      .filter((file): file is string => Boolean(file))
      .filter(file => !isSensitiveWorkspacePath(file));
    const files = this.listFiles('.', 1000);
    const scored = files
      .filter(file => /\.(ts|tsx|js|jsx|json|md)$/.test(file))
      .map(file => {
        const normalized = file.toLowerCase();
        let score = 0;
        for (const token of lower.split(/[^a-z0-9]+/).filter(Boolean)) {
          if (normalized.includes(token)) score += 2;
        }
        if (normalized.includes('orchestrator')) score += lower.includes('orchestrator') ? 10 : 0;
        if (normalized.includes('rag')) score += lower.includes('rag') ? 6 : 0;
        if (normalized.includes('package.json')) score += 1;
        return { file, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.file);

    const fallback = scored.length > 0 ? scored : ['package.json'];
    const selected = [...new Set([...structurallySelected, ...fallback])].slice(0, 24);
    const fileExcerpts: Array<{ path: string; content: string }> = [];
    const relatedTests: Array<{ path: string; content: string }> = [];
    for (const file of selected) {
      const result = await execute({
        toolId: 'read_project_file',
        parameters: { path: file, maxBytes: 20000 }
      });
      if (result.success && result.data?.content) {
        const excerpt = { path: file, content: result.data.content };
        if (file.includes('.test.') || file.includes('__tests__')) {
          relatedTests.push(excerpt);
        } else {
          fileExcerpts.push(excerpt);
        }
      }
    }

    return {
      filesInspected: selected,
      fileExcerpts,
      relatedTests,
      packageScripts: scriptsResult.success ? scriptsResult.data?.scripts || {} : {},
      architectureNotes: [
        ...this.extractArchitectureNotes(selected),
        ...structuralEvidence
          .filter(item => item.kind === 'architecture' || item.kind === 'dependency' || item.kind === 'instruction')
          .map(item => `${item.reason}: ${item.label}`)
      ].slice(0, 24),
      toolCalls
    };
  }

  private summarizeFromEvidence(
    message: string,
    filesInspected: string[],
    evidence?: { fileExcerpts: Array<{ path: string; content: string }> }
  ): string {
    if (message.toLowerCase().includes('enhanced orchestrator')) {
      return `EnhancedOrchestrator is implemented in ${filesInspected.find(file => file.includes('EnhancedOrchestrator')) || 'src/core/orchestrator/EnhancedOrchestrator.ts'}.`;
    }
    if (evidence?.fileExcerpts.some(file => file.content.includes('createCodeRouter'))) {
      return 'The code routes are implemented by createCodeRouter and mounted through the server route stack.';
    }
    return `Inspected ${filesInspected.length} file(s): ${filesInspected.join(', ')}.`;
  }

  private primarySearchTerm(message: string): string {
    const tokens = message
      .split(/[^A-Za-z0-9_]+/)
      .filter(token => token.length > 3);
    return tokens.find(token => /^[A-Z]/.test(token)) || tokens[0] || 'router';
  }

  private messageWithContext(message: string, context?: ChatContextBundle): string {
    if (!context) return message;
    const rendered = renderChatContext(context);
    return rendered.trim()
      ? `${rendered}\n\nUser request:\n${message}`
      : message;
  }

  private async generateModelPatch(
    adapter: LLMAdapter,
    model: string | undefined,
    request: string,
    context: AllocatedContext
  ): Promise<{ patch: GeneratedPatch; structuredPatch?: StructuredPatch; risks: string[] }> {
    const response = await adapter.generate({
      model,
      temperature: 0,
      maxTokens: Math.max(256, Math.min(context.tokenBudget, Number(process.env.CODING_MODEL_MAX_OUTPUT_TOKENS || 8192))),
      systemPrompt: [
        'You are a repository coding agent.',
        'Return only JSON with this shape: {"operations":[{"operation":"create|modify|delete","path":"relative/path","content":"new content for create/modify","expectedContent":"current content for modify/delete","reason":"why","authorized":false}]}',
        'Use repository-relative paths. Never claim an operation is authorized. Do not include markdown fences or shell commands.'
      ].join(' '),
      prompt: `${request}\n\nRepository evidence:\n${context.items.map(item => `${item.kind}: ${item.label}\n${item.content}`).join('\n\n')}`
    });
    const parsed = this.parseModelOperations(response.content);
    if (!parsed) {
      return { patch: this.patchGenerator.createEmptyPatch('The selected coding model did not return the required structured operation format.'), risks: ['Model output was not valid structured patch JSON; no patch was created'] };
    }
    const structured = this.editEngine.createPatch(parsed, { requireAuthorization: false });
    return {
      patch: { format: 'unified-diff', diff: structured.diff, filesChanged: structured.filesChanged, explanation: structured.conflicts.length ? 'Model patch requires conflict review before application.' : 'Structured patch proposed by the selected coding model.' },
      structuredPatch: structured,
      risks: structured.conflicts.map(conflict => `${conflict.path}: ${conflict.reason}`)
    };
  }

  private parseModelOperations(content: string): EditOperation[] | undefined {
    const candidate = content.match(/\{[\s\S]*\}/)?.[0];
    if (!candidate) return undefined;
    try {
      const value = JSON.parse(candidate) as { operations?: unknown };
      if (!Array.isArray(value.operations)) return undefined;
      const operations = value.operations.filter((operation): operation is EditOperation => {
        if (!operation || typeof operation !== 'object') return false;
        const item = operation as Record<string, unknown>;
        return (item.operation === 'create' || item.operation === 'modify' || item.operation === 'delete')
          && typeof item.path === 'string'
          && typeof item.reason === 'string'
          && (item.content === undefined || typeof item.content === 'string')
          && (item.expectedContent === undefined || typeof item.expectedContent === 'string');
      }).map(operation => ({ ...operation, authorized: false }));
      return operations;
    } catch {
      return undefined;
    }
  }

  private extractArchitectureNotes(files: string[]): string[] {
    const notes: string[] = [];
    if (files.some(file => file.includes('orchestrator'))) {
      notes.push('Coding requests are delegated before normal chat generation when the task is classified as code generation.');
    }
    if (files.some(file => file.includes('routes'))) {
      notes.push('Server route files expose API endpoints and are mounted from server/index.ts.');
    }
    return notes;
  }

  private listFiles(dir: string, maxFiles: number): string[] {
    const root = path.resolve(this.workspaceRoot, dir);
    const results: string[] = [];
    const ignored = new Set(['node_modules', '.git', 'dist', 'coverage', 'build']);
    const walk = (current: string) => {
      if (results.length >= maxFiles) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (results.length >= maxFiles || ignored.has(entry.name)) continue;
        const absolute = path.join(current, entry.name);
        const relative = path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
        if (isSensitiveWorkspacePath(relative)) continue;
        if (entry.isDirectory()) {
          walk(absolute);
        } else {
          results.push(path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/'));
        }
      }
    };
    walk(root);
    return results;
  }
}
