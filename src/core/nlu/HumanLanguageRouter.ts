import { Phrasebook, PhrasebookEntry } from './DomainPhrasebook';
import { ClarifyingQuestionBuilder } from './ClarifyingQuestionBuilder';
import { IntentCandidateRanker } from './IntentCandidateRanker';
import { SlangNormalizer } from './SlangNormalizer';
import { VibeInterpreter } from './VibeInterpreter';
import { allPhrasebooks } from './phrasebooks';

export interface HumanLanguageRouterInput {
  message: string;
  explicitMode?: string;
  userContext?: Record<string, any>;
}

export interface HumanLanguageRoute {
  domain?: string;
  intent?: string;
  route?: string;
  confidence: number;
  matchedPhrases: string[];
  aliasesDetected: string[];
  normalizedQuery: string;
  meaning?: string;
  slots: Record<string, string>;
  vibes: string[];
  candidateDomains: string[];
  clarification?: string;
}

export class HumanLanguageRouter {
  private normalizer = new SlangNormalizer();
  private ranker = new IntentCandidateRanker();
  private clarifier = new ClarifyingQuestionBuilder();
  private vibes = new VibeInterpreter();

  constructor(private readonly phrasebook: Phrasebook = allPhrasebooks) {}

  route(input: HumanLanguageRouterInput): HumanLanguageRoute {
    const normalized = this.normalizer.normalize(input.message);
    const vibe = this.vibes.interpret(normalized.normalized);
    const explicitRoute = this.explicitRoute(input.explicitMode, normalized.normalized);
    if (explicitRoute) return explicitRoute;

    const candidates = this.ranker.rank(normalized.normalized, this.phrasebook);
    const top = candidates[0];
    if (!top) {
      return {
        confidence: 0,
        matchedPhrases: [],
        aliasesDetected: normalized.aliasesDetected,
        normalizedQuery: this.withVibeHints(normalized.normalized, vibe.normalizedHints),
        slots: {},
        vibes: vibe.vibes,
        candidateDomains: []
      };
    }

    const candidateDomains = Array.from(new Set(candidates.slice(0, 3).map(candidate => candidate.entry.domain)));
    const entry = top.entry;
    const route: HumanLanguageRoute = {
      domain: entry.domain,
      intent: entry.intent,
      route: entry.route || entry.domain,
      confidence: top.score,
      matchedPhrases: top.matchedPhrases,
      aliasesDetected: normalized.aliasesDetected,
      normalizedQuery: this.withVibeHints(entry.meaning, vibe.normalizedHints),
      meaning: entry.meaning,
      slots: {
        ...entry.slots,
        ...this.extractSlots(normalized.normalized)
      },
      vibes: vibe.vibes,
      candidateDomains
    };

    if (route.confidence >= 0.45 && route.confidence < 0.75) {
      route.clarification = this.clarifier.build(route);
    }

    return route;
  }

  private explicitRoute(explicitMode: string | undefined, message: string): HumanLanguageRoute | undefined {
    if (!explicitMode || explicitMode === 'ask') return undefined;
    return {
      domain: explicitMode,
      intent: `${explicitMode}.explicit`,
      route: explicitMode,
      confidence: 1,
      matchedPhrases: [],
      aliasesDetected: [],
      normalizedQuery: message,
      slots: {},
      vibes: [],
      candidateDomains: [explicitMode]
    };
  }

  private withVibeHints(text: string, hints: string[]): string {
    if (hints.length === 0) return text;
    return `${text}. Vibe hints: ${hints.join('; ')}`;
  }

  private extractSlots(message: string): Record<string, string> {
    const slots: Record<string, string> = {};
    if (/\b808\b/.test(message)) slots.target = slots.target || '808';
    if (/\bkick\b/.test(message)) slots.secondaryTarget = 'kick';
    if (/\bvocal/.test(message)) slots.target = slots.target || 'vocal';
    if (/\bmelody\b/.test(message)) slots.target = slots.target || 'melody';
    if (/\bdrums?\b/.test(message)) slots.target = slots.target || 'drums';
    if (/\bleft\b/.test(message)) slots.direction = 'left';
    if (/\bright\b/.test(message)) slots.direction = 'right';
    return slots;
  }
}
