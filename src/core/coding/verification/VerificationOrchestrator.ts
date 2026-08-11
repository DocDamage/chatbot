import { BuildCommandPlan, BuildSystemDetector } from '../repository/BuildSystemDetector';
import { ManifestDetector } from '../repository/ManifestDetector';
import { LanguageCapabilityRegistry } from '../languages/LanguageCapabilityRegistry';
import { RepositoryIntelligence } from '../repository/RepositoryIntelligence';
import { Diagnostic, VerificationResult } from '../types';
import { CommandCapabilityRunner } from './CommandCapabilityRunner';
import { DiagnosticParser } from './DiagnosticParser';
import { RepairCallbacks, RepairController, RepairRun } from './RepairController';

export interface VerificationSummary { status: 'passed' | 'failed' | 'blocked' | 'not_run'; results: VerificationResult[]; remainingRisks: string[]; repairIterations: number; }

export class VerificationOrchestrator {
  constructor(private readonly workspaceRoot: string, private readonly maxRepairIterations = 3, private readonly registry = new LanguageCapabilityRegistry()) {}

  async verify(options: { files?: string[]; maxCommands?: number; run?: boolean } = {}): Promise<VerificationSummary> {
    if (options.run === false) return { status: 'not_run', results: [], remainingRisks: ['Verification was disabled by the caller'], repairIterations: 0 };
    const snapshot = new RepositoryIntelligence(this.workspaceRoot, this.registry).snapshot();
    const plans = snapshot.commandPlans.filter(plan => ['typecheck', 'lint', 'test', 'build'].includes(plan.purpose)).slice(0, options.maxCommands || 8);
    if (!plans.length) return { status: 'blocked', results: [], remainingRisks: ['No supported project verification command was detected'], repairIterations: 0 };
    const runner = new CommandCapabilityRunner(this.workspaceRoot);
    const parser = new DiagnosticParser();
    const results: VerificationResult[] = [];
    for (const plan of plans) {
      const result = await runner.run(plan);
      const output = `${result.stdout}\n${result.stderr}`;
      const diagnostics: Diagnostic[] = parser.parse(plan.executable, output).map(diagnostic => ({ ...diagnostic, file: diagnostic.file?.replace(/\\/g, '/') }));
      results.push({ command: [plan.executable, ...plan.argv].join(' '), argv: [plan.executable, ...plan.argv], exitCode: result.exitCode, durationMs: result.durationMs, diagnostics, stdout: result.stdout, stderr: result.stderr, status: result.status });
      if (result.status === 'failed' || result.status === 'timed_out') break;
    }
    const failed = results.some(result => ['failed', 'timed_out', 'blocked'].includes(result.status));
    return { status: failed ? 'failed' : 'passed', results, remainingRisks: failed ? ['Verification reported failures; no automatic repair was applied'] : [], repairIterations: 0 };
  }

  async verifyWithRepair(callbacks: Omit<RepairCallbacks, 'verify'>, options: { maxCommands?: number; maxIterations?: number } = {}): Promise<RepairRun> {
    const controller = new RepairController(options.maxIterations ?? this.maxRepairIterations);
    return controller.run({ ...callbacks, verify: async () => (await this.verify({ maxCommands: options.maxCommands })).results });
  }
}
