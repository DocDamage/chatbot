import { FLStudioControlAgent } from '../../../integrations/flstudio/FLStudioControlAgent';
import { FLTemplateInspectorTool } from '../../../tools/flstudio/FLTemplateInspectorTool';
import { MixDiagnosticEngine } from './MixDiagnosticEngine';
import { MixIntentClassifier } from './MixIntentClassifier';
import { FLStudioMixController } from './FLStudioMixController';
import { MasteringAdvisor } from './MasteringAdvisor';
import { MixPlanner, MixMove } from './MixPlanner';
import { MixPassReport } from './MixPassReport';
import { MixRevisionLoop } from './MixRevisionLoop';
import { ReferenceMixAnalyzer } from './ReferenceMixAnalyzer';

export class MixGeniusAgent {
  private classifier = new MixIntentClassifier();
  private diagnostics = new MixDiagnosticEngine();
  private planner = new MixPlanner();
  private reference = new ReferenceMixAnalyzer();
  private revision = new MixRevisionLoop();
  private mastering = new MasteringAdvisor();
  private reports = new MixPassReport();
  private template = new FLTemplateInspectorTool();
  private controller: FLStudioMixController;

  constructor(flStudioControlAgent?: FLStudioControlAgent) {
    this.controller = new FLStudioMixController(flStudioControlAgent);
  }

  analyze(input: Record<string, any>) {
    const mode = this.classifier.classify(String(input.query || input.notes || ''));
    const diagnostics = this.diagnostics.analyze({ ...input, mode });
    return {
      domain: 'music',
      mode,
      analysis: diagnostics,
      reference: this.reference.compare(input),
      template: this.template.run(),
      response: this.formatAnalysis(mode, diagnostics),
      model: 'mix-genius'
    };
  }

  plan(input: Record<string, any>) {
    const analyzed = this.analyze(input);
    const moves = this.planner.plan(input, analyzed.mode, analyzed.analysis);
    return {
      ...analyzed,
      targetProfile: this.targetProfile(input, analyzed.mode),
      moves,
      approvalRequired: moves.some(move => move.requiresConfirmation),
      response: this.formatPlan(analyzed.mode, moves)
    };
  }

  async apply(input: Record<string, any>) {
    const plan = this.plan(input);
    const permissionMode = this.normalizePermissionMode(input.permissionMode || input.mode || 'dry_run');
    const flResult = await this.controller.apply(plan.moves, {
      mode: permissionMode,
      confirmed: input.confirmed === true
    });
    const passReport = this.reports.create({
      moves: plan.moves,
      flResult,
      beforeSnapshot: (flResult as any).beforeSnapshot,
      permissionMode
    });

    return {
      ...plan,
      flResult,
      passReport,
      response: [
        plan.response,
        '',
        'Before/after report:',
        `- Snapshot captured: ${passReport.snapshotCaptured ? 'yes' : 'no'}`,
        `- Automatable moves: ${passReport.automatableMoves}`,
        `- Dry-run moves: ${passReport.dryRunMoves}`,
        `- Touched targets: ${passReport.touchedTargets.join(', ') || 'none'}`,
        '',
        'FL Studio application:',
        (flResult as any).response || (flResult as any).message || 'Mix pass moves prepared.'
      ].join('\n')
    };
  }

  revise(input: Record<string, any>) {
    const plan = this.plan(input);
    return {
      ...plan,
      revision: this.revision.revise(input, input.previousPlan),
      response: [
        plan.response,
        '',
        'Revision loop:',
        '- Render or replay after this pass.',
        '- Compare against the target profile/reference.',
        '- Apply smaller follow-up moves only after approval.'
      ].join('\n')
    };
  }

  master(input: Record<string, any>) {
    const plan = this.plan({ ...input, query: `${input.query || ''} loud master` });
    return {
      ...plan,
      mastering: this.mastering.advise(input),
      response: [
        plan.response,
        '',
        'Mastering guardrail:',
        '- Fix clipping, vocal balance, and low-end masking before pushing limiter loudness.',
        '- Master changes are confirmation-gated.'
      ].join('\n')
    };
  }

  private targetProfile(input: Record<string, any>, mode: string) {
    return {
      genre: input.genre || 'trap / modern production',
      mode,
      reference: input.reference || 'none',
      vocalFocus: input.vocalFocus || 'clear and centered',
      lowEndTarget: input.lowEndTarget || 'huge but controlled',
      loudnessTarget: input.loudnessTarget || 'streaming / demo safe',
      stereoTarget: input.stereoTarget || 'mono-safe low end, wide melodies, centered vocal',
      delivery: input.delivery || 'professional first-pass mix'
    };
  }

  private normalizePermissionMode(mode: string) {
    return mode === 'confirm_each_move' ? 'confirm_required' : mode;
  }

  private formatAnalysis(mode: string, diagnostics: any) {
    return [
      `Mix Genius Analysis (${mode})`,
      '',
      'Problems found:',
      ...diagnostics.problems.map((problem: string) => `- ${problem}`),
      '',
      `Confidence: ${diagnostics.confidence.toFixed(2)}`,
      diagnostics.audio.warning ? `Warning: ${diagnostics.audio.warning}` : ''
    ].filter(Boolean).join('\n');
  }

  private formatPlan(mode: string, moves: MixMove[]) {
    return [
      `Mix Genius Plan (${mode})`,
      '',
      'Suggested moves:',
      ...moves.map((move, index) => `${index + 1}. ${move.target}: ${move.action}${move.amount ? ` (${move.amount})` : ''}\n   Reason: ${move.reason}`),
      '',
      'Need before live apply:',
      '- FL Studio MCP connected.',
      '- Mixer tracks named/mapped to the template.',
      '- Permission mode: dry_run, confirm_each_move, or live_control.',
      '- Approval before master/plugin/render changes.'
    ].join('\n');
  }
}
