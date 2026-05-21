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

export interface CodingAgentConfig {
  workspaceRoot?: string;
  toolRegistry?: ToolRegistry;
  functionCaller?: FunctionCaller;
  verificationRunner?: VerificationRunner;
}

export interface CodingAgentRequest {
  message: string;
  runVerification?: boolean;
  context?: ChatContextBundle;
}

export interface CodingAgentResult {
  intent: CodingIntent;
  summary: string;
  filesInspected: string[];
  plan: CodePlan;
  patch: GeneratedPatch;
  commandsRun: string[];
  verification: VerificationSummary;
  review: CodeReviewResult;
  toolCalls: ToolCall[];
  context: CodeContext;
  risks: string[];
  nextStep?: string;
}

export class CodingAgent {
  private readonly workspaceRoot: string;
  private readonly planner = new CodePlanner();
  private readonly reviewer = new CodeReviewer();
  private readonly patchGenerator = new PatchGenerator();
  private readonly contextBudgeter = new CodeContextBudgeter(4000);
  private readonly indexer: CodeIndexer;
  private readonly functionCaller: FunctionCaller;
  private readonly verificationRunner: VerificationRunner;

  constructor(config: CodingAgentConfig = {}) {
    this.workspaceRoot = config.workspaceRoot || process.cwd();
    this.indexer = new CodeIndexer(this.workspaceRoot);

    const registry = config.toolRegistry || new ToolRegistry();
    if (!config.toolRegistry) {
      for (const tool of createRepoTools(this.workspaceRoot)) {
        registry.register(tool);
      }
    }
    this.functionCaller = config.functionCaller || new FunctionCaller(registry);
    this.verificationRunner = config.verificationRunner || new VerificationRunner(new CommandRunner(this.workspaceRoot));
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
    const summary = this.summarizeFromEvidence(contextualMessage, filesInspected, evidence);
    const patch = this.patchGenerator.createEmptyPatch();
    const verification = request.runVerification
      ? await this.verificationRunner.runStandardSuite()
      : { status: 'not_run' as const, commandsRun: [], results: [], remainingRisks: ['Verification was not requested'] };
    const review = this.reviewer.review(patch.diff);

    return {
      intent: plan.intent,
      summary,
      filesInspected,
      plan,
      patch,
      commandsRun: verification.commandsRun,
      verification,
      review,
      toolCalls: evidence.toolCalls,
      context,
      risks: verification.remainingRisks,
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

    const selected = scored.length > 0 ? scored : ['package.json'];
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
      architectureNotes: this.extractArchitectureNotes(selected),
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
