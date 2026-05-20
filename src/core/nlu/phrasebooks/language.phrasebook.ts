import { Phrasebook } from '../DomainPhrasebook';

export const languagePhrasebook: Phrasebook = [
  {
    phrases: ['make this sound better', 'rewrite this', 'say this nicer', 'make it professional', 'fix my grammar'],
    intent: 'rewrite_or_tone',
    meaning: 'rewrite, tone, grammar, rhetoric, or communication help',
    domain: 'language',
    route: 'language'
  }
];
