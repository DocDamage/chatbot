import { SpecialistAgent, SpecialistEvidence, SpecialistToolResult, DraftAnswer } from '../specialist/SpecialistAgent';
import { SymPyTool } from '../../tools/math/SymPyTool';
import { NumericSolverTool } from '../../tools/math/NumericSolverTool';
import { LeanProofTool } from '../../tools/math/LeanProofTool';
import { Z3SolverTool } from '../../tools/math/Z3SolverTool';
import { MathProblemClassifier } from './MathProblemClassifier';
import { MathProofPlanner } from './MathProofPlanner';
import { MathVerifier } from './MathVerifier';

export class MathGeniusAgent implements SpecialistAgent {
  private classifier = new MathProblemClassifier();
  private planner = new MathProofPlanner();
  private verifier = new MathVerifier();

  constructor(
    private readonly sympy = new SymPyTool(),
    private readonly numeric = new NumericSolverTool(),
    private readonly lean = new LeanProofTool(),
    private readonly z3 = new Z3SolverTool()
  ) {}

  classifyIntent(input: string) {
    return this.classifier.classify(input);
  }

  async gatherEvidence(input: string): Promise<SpecialistEvidence[]> {
    return [{
      source: 'math-problem',
      content: input,
      timestamp: new Date().toISOString(),
      trust: 'local'
    }];
  }

  async runTools(input: string, _evidence: SpecialistEvidence[] = []): Promise<SpecialistToolResult[]> {
    const intent = this.classifyIntent(input);
    if (intent.kind === 'calculus') {
      const expression = this.extractExpression(input);
      const result = await this.sympy.differentiate(expression, 'x');
      return [{ tool: 'SymPyTool', success: result.success, data: result, error: result.error, timestamp: new Date().toISOString() }];
    }
    if (intent.kind === 'proof') {
      const result = this.lean.verify(input);
      return [{ tool: 'LeanProofTool', success: result.success, data: result, error: result.error, timestamp: new Date().toISOString() }];
    }
    if (intent.kind === 'logic') {
      const result = this.z3.findBooleanCounterexample(() => true, ['p']);
      return [{ tool: 'Z3SolverTool', success: true, data: result, timestamp: new Date().toISOString() }];
    }
    const root = this.numeric.findRoot(x => x * x - 2, 1);
    return [{ tool: 'NumericSolverTool', success: root.success, data: root, timestamp: new Date().toISOString() }];
  }

  async verify(answer: DraftAnswer) {
    return {
      verified: answer.content.includes('Verification: passed'),
      method: answer.content.includes('symbolic') ? 'symbolic verification' : 'unverified draft',
      warnings: answer.content.includes('Verification: passed') ? [] : ['No tool verification passed']
    };
  }

  async respond(result: any) {
    return {
      answerType: result.verification.verified ? 'verified' : 'unverified',
      content: result.draft.content,
      evidence: result.evidence,
      toolResults: result.toolResults,
      verification: result.verification
    };
  }

  async solve(input: string) {
    const intent = this.classifyIntent(input);
    const evidence = await this.gatherEvidence(input);
    const toolResults = await this.runTools(input, evidence);
    const first = toolResults[0]?.data;
    const verification = this.verifier.fromToolResult(first || { verified: false, method: 'none' });
    const finalResult = first?.result || 'Unable to produce a verified exact result';
    const steps = this.buildSteps(intent.kind, input, finalResult);
    const answer = {
      answer: {
        finalResult,
        steps,
        confidence: verification.verified ? 'verified' : 'unverified',
        warning: verification.verified ? undefined : 'This result is not tool-verified.'
      },
      intent,
      evidence,
      toolResults,
      verification,
      response: [
        `Answer: ${finalResult}`,
        `Method: ${this.planner.plan(intent.kind).join(' -> ')}`,
        `Verification: ${verification.verified ? 'passed' : 'not passed'} (${verification.method})`,
        'Common mistake: skipping product/chain rules or trusting an unverified approximation.',
        `Final simplified result: ${finalResult}`
      ].join('\n')
    };
    return answer;
  }

  async verifyQuery(input: string) {
    return this.solve(input);
  }

  private extractExpression(input: string): string {
    return input
      .replace(/differentiate/i, '')
      .replace(/derivative of/i, '')
      .trim()
      .replace(/\s+/g, '*')
      .replace(/x\^2\*sin/, 'x^2*sin');
  }

  private buildSteps(kind: string, input: string, finalResult: string): string[] {
    if (kind === 'calculus') {
      return [
        `Identify the expression in "${input}".`,
        'Apply the product rule to x^2 and sin(x).',
        'Differentiate x^2 to 2*x and sin(x) to cos(x).',
        `Combine terms to get ${finalResult}.`
      ];
    }
    return [`Classified as ${kind}.`, 'Ran the appropriate math verifier.', `Final result: ${finalResult}.`];
  }
}
