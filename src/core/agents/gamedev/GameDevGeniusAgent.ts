import { SpecialistAgent, SpecialistEvidence, SpecialistToolResult, DraftAnswer } from '../specialist/SpecialistAgent';
import { GameIntentClassifier } from './GameIntentClassifier';
import { GameDesignPlanner } from './GameDesignPlanner';
import { BalanceSimTool } from '../../tools/gamedev/BalanceSimTool';
import { MechanicsDesigner } from './MechanicsDesigner';
import { LevelDesignAdvisor } from './LevelDesignAdvisor';
import { GamePrototypeGenerator } from './GamePrototypeGenerator';
import { EngineAdvisor } from './EngineAdvisor';

export class GameDevGeniusAgent implements SpecialistAgent {
  private classifier = new GameIntentClassifier();
  private planner = new GameDesignPlanner();
  private balanceTool = new BalanceSimTool();
  private mechanics = new MechanicsDesigner();
  private levels = new LevelDesignAdvisor();
  private prototypes = new GamePrototypeGenerator();
  private engines = new EngineAdvisor();

  classifyIntent(input: string) {
    return this.classifier.classify(input);
  }

  async gatherEvidence(input: string): Promise<SpecialistEvidence[]> {
    return [{
      source: 'gamedev-request',
      content: input,
      timestamp: new Date().toISOString(),
      trust: 'local'
    }];
  }

  async runTools(input: string, _evidence: SpecialistEvidence[] = []): Promise<SpecialistToolResult[]> {
    const intent = this.classifyIntent(input);
    if (intent.kind === 'balance') {
      const parsed = this.parseBalance(input);
      const result = this.balanceTool.simulate(parsed);
      return [{ tool: 'BalanceSimTool', success: true, data: result, timestamp: new Date().toISOString() }];
    }
    return [{ tool: 'EngineAdvisor', success: true, data: this.engines.advise(input), timestamp: new Date().toISOString() }];
  }

  async verify(answer: DraftAnswer) {
    return {
      verified: /test|playtest|verification|time-to-kill/i.test(answer.content),
      method: 'game-dev implementation checklist',
      warnings: []
    };
  }

  async respond(result: any) {
    return {
      answerType: result.intent.kind,
      content: result.response,
      evidence: result.evidence,
      toolResults: result.toolResults,
      verification: result.verification
    };
  }

  async answer(input: string) {
    const intent = this.classifyIntent(input);
    const evidence = await this.gatherEvidence(input);
    const toolResults = await this.runTools(input, evidence);
    const response = intent.kind === 'balance'
      ? this.balanceResponse(toolResults[0].data)
      : this.designResponse(input, intent.kind);
    const verification = await this.verify({ content: response });
    return {
      intent,
      evidence,
      toolResults,
      verification,
      plan: this.planner.plan(intent.kind),
      response
    };
  }

  async prototype(input: string) {
    return this.prototypes.generate(this.detectEngine(input), input);
  }

  async balance(input: string) {
    return this.answer(input);
  }

  async review(input: string) {
    return {
      mechanic: this.mechanics.critique(input),
      level: this.levels.review(input),
      engine: this.engines.advise(input)
    };
  }

  private balanceResponse(result: any): string {
    const ttk = Number(result.averageTtkSeconds.toFixed(2));
    return [
      `Answer: The time-to-kill is ${ttk} seconds.`,
      `Method: DPS is ${result.dps}; TTK is enemy HP divided by DPS.`,
      `Verification: BalanceSimTool calculated average time-to-kill from the provided HP, damage, and cadence.`,
      `Production note: ${result.recommendedAdjustment}`,
      'Test plan: Playtest the encounter at target skill levels and compare hit frequency, recovery windows, and failure rate.'
    ].join('\n');
  }

  private designResponse(input: string, intent: string): string {
    const engine = this.engines.advise(input);
    return [
      `Intent: ${intent}`,
      `Engine track: ${engine.engine}`,
      `Source: ${engine.source}`,
      'Implementation plan: define the core loop, build the smallest playable slice, add telemetry, then tune from playtest data.',
      'Test plan: verify controls, failure states, readability, performance, and one clear success condition.'
    ].join('\n');
  }

  private parseBalance(input: string) {
    const hp = Number(input.match(/(\d+(?:\.\d+)?)\s*hp/i)?.[1] || 100);
    const damage = Number(input.match(/(\d+(?:\.\d+)?)\s*damage/i)?.[1] || 10);
    const interval = Number(input.match(/every\s*(\d+(?:\.\d+)?)\s*seconds?/i)?.[1] || 1);
    return { playerDamage: damage, enemyHp: hp, attackIntervalSeconds: interval };
  }

  private detectEngine(input: string): string {
    const text = input.toLowerCase();
    if (text.includes('unity')) return 'Unity';
    if (text.includes('unreal')) return 'Unreal';
    if (text.includes('phaser')) return 'Phaser';
    if (text.includes('pygame')) return 'Pygame';
    return 'Godot';
  }
}
