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
    const attempts: RepairAttempt[] = [];
    let current = await callbacks.verify();
    for (let iteration = 1; iteration <= this.maxIterations && this.errors(current).length > 0; iteration += 1) {
      const beforeDiagnostics = this.diagnostics(current);
      const proposal = await callbacks.propose(beforeDiagnostics, iteration);
      if (!proposal || proposal.operations.length === 0) break;
      await callbacks.apply(proposal.operations);
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
    }
    const remainingRisks = this.errors(current).map(diagnostic => `${diagnostic.file || 'project'}: ${diagnostic.message}`);
    return { status: remainingRisks.length === 0 ? 'passed' : attempts.length >= this.maxIterations ? 'failed' : 'blocked', attempts, finalVerification: current, remainingRisks };
  }

  private errors(results: VerificationResult[]): Diagnostic[] { return results.flatMap(result => result.diagnostics).filter(diagnostic => diagnostic.severity === 'error'); }
  private diagnostics(results: VerificationResult[]): Diagnostic[] { return results.flatMap(result => result.diagnostics); }
  private key(diagnostic: Diagnostic): string { return `${diagnostic.file || ''}:${diagnostic.line || ''}:${diagnostic.column || ''}:${diagnostic.code || ''}:${diagnostic.message}`; }
  private delta(before: Diagnostic[], after: Diagnostic[]): RepairAttempt['diagnosticDelta'] {
    const beforeKeys = new Set(before.map(diagnostic => this.key(diagnostic)));
    const afterKeys = new Set(after.map(diagnostic => this.key(diagnostic)));
    return { before: before.length, after: after.length, resolved: before.filter(diagnostic => !afterKeys.has(this.key(diagnostic))).length, introduced: after.filter(diagnostic => !beforeKeys.has(this.key(diagnostic))).length };
  }
}
