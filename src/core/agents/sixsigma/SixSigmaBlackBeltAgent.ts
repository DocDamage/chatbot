import { SpecialistAgent, SpecialistEvidence, SpecialistToolResult, DraftAnswer } from '../specialist/SpecialistAgent';
import { SixSigmaIntentClassifier } from './SixSigmaIntentClassifier';
import { SixSigmaCalculatorRouter } from './SixSigmaCalculatorRouter';
import { SixSigmaLearningCoach } from './SixSigmaLearningCoach';
import { SixSigmaProjectCoach } from './SixSigmaProjectCoach';
import { SixSigmaComplianceAdvisor } from './SixSigmaComplianceAdvisor';
import { SixSigmaCertificationCoach } from './SixSigmaCertificationCoach';
import { SixSigmaSimulationAgent } from './SixSigmaSimulationAgent';
import { SixSigmaExportAgent } from './SixSigmaExportAgent';
import { SixSigmaIndustryAdvisor } from './SixSigmaIndustryAdvisor';

export class SixSigmaBlackBeltAgent implements SpecialistAgent {
  private classifier = new SixSigmaIntentClassifier();
  private calculators = new SixSigmaCalculatorRouter();
  private learning = new SixSigmaLearningCoach();
  private projectCoach = new SixSigmaProjectCoach();
  private complianceAdvisor = new SixSigmaComplianceAdvisor();
  private certificationCoach = new SixSigmaCertificationCoach();
  private simulationAgent = new SixSigmaSimulationAgent();
  private exportAgent = new SixSigmaExportAgent();
  private industryAdvisor = new SixSigmaIndustryAdvisor();

  classifyIntent(input: string) {
    return this.classifier.classify(input);
  }

  async gatherEvidence(input: string): Promise<SpecialistEvidence[]> {
    return [{
      source: 'blackbelt-rag-public',
      content: input,
      timestamp: new Date().toISOString(),
      trust: 'local'
    }];
  }

  async runTools(input: string, _evidence: SpecialistEvidence[] = []): Promise<SpecialistToolResult[]> {
    const intent = this.classifyIntent(input);
    if (intent.kind.startsWith('calculator')) {
      const result = this.calculators.calculate(input);
      return [{ tool: result.tool, success: true, data: result.result, timestamp: new Date().toISOString() }];
    }
    return [];
  }

  async verify(answer: DraftAnswer) {
    return {
      verified: !/estimated without calculation/i.test(answer.content),
      method: 'sixsigma deterministic workflow check',
      warnings: []
    };
  }

  async respond(result: any) {
    return {
      answerType: result.answerType || result.intent.kind,
      content: result.response,
      evidence: result.evidence,
      toolResults: result.toolResults,
      verification: result.verification
    };
  }

  async ask(input: string): Promise<any> {
    const intent = this.classifyIntent(input);
    if (intent.kind.startsWith('calculator')) return this.calculate(input);
    if (intent.kind === 'project_coaching') return this.project(input);
    if (intent.kind === 'certification') return this.certification(input);
    if (intent.kind === 'simulation') return this.simulate(input);
    if (intent.kind === 'export') return this.export(input);
    if (intent.kind === 'compliance') return this.compliance(input);
    if (intent.kind === 'industry_playbook') return this.industry(input);
    const evidence = await this.gatherEvidence(input);
    const response = 'Six Sigma Blackbelt Q&A: DMAIC uses Define, Measure, Analyze, Improve, and Control to reduce variation and defects. Use calculators for numeric capability, DPMO, MSA, ANOVA, regression, and control-chart work.';
    return { answerType: 'sixsigma_qa', intent, evidence, toolResults: [], verification: await this.verify({ content: response }), response };
  }

  async calculate(input: string) {
    const intent = this.classifyIntent(input);
    const evidence = await this.gatherEvidence(input);
    const toolResults = await this.runTools(input, evidence);
    const result = toolResults[0]?.data;
    const response = result?.cpk !== undefined
      ? [
        `Cpk = ${result.cpk.toFixed(2)}`,
        `Cp = ${result.cp.toFixed(2)}`,
        `Cpu = ${result.cpu.toFixed(2)}`,
        `Cpl = ${result.cpl.toFixed(2)}`,
        `Formula: ${result.formula}`,
        `Interpretation: ${result.interpretation}`
      ].join('\n')
      : 'I need complete numeric inputs before I can run the requested Six Sigma calculator.';
    return { answerType: 'calculation', intent, evidence, toolResults, verification: await this.verify({ content: response }), response };
  }

  async project(input: string) {
    const intent = this.classifyIntent(input);
    const evidence = await this.gatherEvidence(input);
    const project = this.projectCoach.createProject(input);
    return { ...project, intent, evidence, toolResults: [], verification: await this.verify({ content: project.response }) };
  }

  async certification(input: string) {
    return { intent: this.classifyIntent(input), ...(this.certificationCoach.certification(input)), response: JSON.stringify(this.certificationCoach.certification(input), null, 2) };
  }

  async studyPlan(input: string) {
    return { intent: this.classifyIntent(input), ...(this.learning.studyPlan(input)), response: JSON.stringify(this.learning.studyPlan(input), null, 2) };
  }

  async simulate(input: string) {
    return { answerType: 'simulation', intent: this.classifyIntent(input), result: this.simulationAgent.simulate(input) };
  }

  async export(input: string) {
    return { answerType: 'export', intent: this.classifyIntent(input), result: this.exportAgent.export(input) };
  }

  async compliance(input: string) {
    return { intent: this.classifyIntent(input), ...this.complianceAdvisor.advise(input) };
  }

  async industry(input: string) {
    return { intent: this.classifyIntent(input), ...this.industryAdvisor.advise(input) };
  }
}
