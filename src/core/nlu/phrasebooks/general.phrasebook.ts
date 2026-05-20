import { Phrasebook } from '../DomainPhrasebook';

export const generalPhrasebook: Phrasebook = [
  {
    phrases: ['explain this like im not a nerd', 'explain this simply', 'what does this mean'],
    intent: 'general.explain',
    meaning: 'plain-language explanation',
    domain: 'general',
    route: undefined,
    confidence: 0.48
  }
];
