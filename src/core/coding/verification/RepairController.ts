import { Diagnostic, EditOperation, VerificationResult } from '../types';

export interface RepairAttempt {
  iteration: number;
  hypothesis: string;
  operations: EditOperation[];
  verification: VerificationResult[];
  diagnosticDelta: { before: number; after: number; resolved: number; introduced: number };
  remainingRisk: string[];
}

export interface RepairRun {
  status: 'passed' | 'failed' | 'blocked';
  attempts: RepairAttempt[];
  finalVerification: VerificationResult[];
  remainingRisks: string[];
}

export interface RepairCallbacks {
  verify: () => Promise<VerificationResult[]>;
  propose: (diagnostics: Diagnostic[], iteration: number) => Promise<{ hypothesis: string; operations: EditOperation[] } | undefined>;
  apply: (operations: EditOperation[]) => Promise<void>;
}

export class RepairController {
  constructor(private readonly maxIterations = 3) {}

  async run(callbacks: RepairCallbacks): Promise<RepairRun> {
    if (!Number.isInteger(this.maxIterations) || this.maxIterations < 1 || this.maxIterations > 5) throw new Error('Repair iterations must be between 1 and 5.');
    const attempts: RepairAttempt[] = [];
    let current = await callbacks.verify();
    if (this.blocked(current)) return { status: 'blocked', attempts, finalVerification: current, remainingRisks: ['Verification was unavailable, blocked or skipped; success was not established.'] };
    for (let iteration = 1; iteration <= this.maxIterations && this.failed(current); iteration += 1) {
      const beforeDiagnostics = this.diagnostics(current);
      let proposal: Awaited<ReturnType<RepairCallbacks['propose']>>;
      try { proposal = await callbacks.propose(beforeDiagnostics, iteration); }
      catch (error: any) { return { status: 'blocked', attempts, finalVerification: current, remainingRisks: [`Repair proposal failed: ${error.message}`] }; }
      if (!proposal || proposal.operations.length === 0) break;
      try { await callbacks.apply(proposal.operations); }
      catch (error: any) { return { status: 'blocked', attempts, finalVerification: current, remainingRisks: [`Repair was not applied: ${error.message}`] }; }
      const next = await callbacks.verify();
      const afterDiagnostics = this.diagnostics(next);
      attempts.push({
        iteration,
        hypothesis: proposal.hypothesis,
        operations: proposal.operations,
        verification: next,
        diagnosticDelta: this.delta(beforeDiagnostics, afterDiagnostics),
        remainingRisk: this.errors(next).map(diagnostic => `${diagnostic.file || 'project'}: ${diagnostic.message}`)
      });
      current = next;
      if (this.blocked(current)) return { status: 'blocked', attempts, finalVerification: current, remainingRisks: ['Verification became unavailable or blocked.'] };
    }
    const remainingRisks = this.errors(current).map(diagnostic => `${diagnostic.file || 'project'}: ${diagnostic.message}`);
    if (this.failed(current) && !remainingRisks.length) remainingRisks.push('A verification command failed without parsed diagnostics.');
    return { status: !this.failed(current) ? 'passed' : attempts.length >= this.maxIterations ? 'failed' : 'blocked', attempts, finalVerification: current, remainingRisks };
  }

  private errors(results: VerificationResult[]): Diagnostic[] { return results.flatMap(result => result.diagnostics).filter(diagnostic => diagnostic.severity === 'error'); }
  private blocked(results: VerificationResult[]): boolean { return !results.length || results.some(result => ['blocked', 'skipped'].includes(result.status)); }
  private failed(results: VerificationResult[]): boolean { return this.errors(results).length > 0 || results.some(result => result.status !== 'passed' || result.exitCode !== 0); }
  private diagnostics(results: VerificationResult[]): Diagnostic[] {
    return results.flatMap(result => result.diagnostics.some(diagnostic => diagnostic.severity === 'error') || result.status === 'passed'
      ? result.diagnostics : [...result.diagnostics, { tool: result.argv[0] || result.command, severity: 'error' as const,
        message: `Verification ${result.status} (exit ${result.exitCode ?? 'unknown'})`, raw: `${result.stdout}\n${result.stderr}`.slice(-6000) }]);
  }
  private key(diagnostic: Diagnostic): string { return `${diagnostic.file || ''}:${diagnostic.line || ''}:${diagnostic.column || ''}:${diagnostic.code || ''}:${diagnostic.message}`; }
  private delta(before: Diagnostic[], after: Diagnostic[]): RepairAttempt['diagnosticDelta'] {
    const beforeKeys = new Set(before.map(diagnostic => this.key(diagnostic)));
    const afterKeys = new Set(after.map(diagnostic => this.key(diagnostic)));
    return { before: before.length, after: after.length, resolved: before.filter(diagnostic => !afterKeys.has(this.key(diagnostic))).length, introduced: after.filter(diagnostic => !beforeKeys.has(this.key(diagnostic))).length };
  }
}
