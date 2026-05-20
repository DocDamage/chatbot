import { GameDevGeniusAgent } from '../gamedev/GameDevGeniusAgent';
import { SpecialistEvidence } from '../specialist/SpecialistAgent';
import { GamingIntentClassifier } from './GamingIntentClassifier';
import { GamingKnowledgeRouter } from './GamingKnowledgeRouter';

export class GamingGeniusAgent {
  private readonly classifier = new GamingIntentClassifier();
  private readonly knowledgeRouter = new GamingKnowledgeRouter();

  constructor(private readonly gameDevAgent = new GameDevGeniusAgent()) {}

  async ask(input: string): Promise<any> {
    const intent = this.classifier.classify(input);
    if (intent.kind === 'gamedev') {
      const delegated = await this.gameDevAgent.answer(input);
      return {
        ...delegated,
        mode: 'gaming',
        delegatedTo: 'gamedev',
        intent
      };
    }

    const evidence: SpecialistEvidence[] = [{
      source: 'gaming-request',
      content: input,
      timestamp: new Date().toISOString(),
      trust: 'local'
    }];
    const sources = this.knowledgeRouter.recommendedSources(intent.kind);
    return {
      mode: 'gaming',
      intent,
      evidence,
      sources,
      response: [
        `Intent: ${intent.kind}`,
        `Answer: For ${intent.kind} questions, start by separating player goals, rules, constraints, and evidence from community opinion.`,
        `Gaming lens: compare mechanics, platform constraints, source authority, player skill assumptions, and patch/version context.`,
        `Sources to prefer: ${sources.join('; ')}.`,
        'Verification: check the game version, ruleset, platform, and whether the claim comes from official material, measured play, or community consensus.'
      ].join('\n')
    };
  }
}
