import { Phrasebook } from '../DomainPhrasebook';

export const legalPhrasebook: Phrasebook = [
  {
    phrases: ['help me not get sued', 'is this contract sketchy', 'what am i signing', 'can they do that legally'],
    intent: 'legal_risk',
    meaning: 'explain legal risk with jurisdiction and non-advice guardrails',
    domain: 'legal',
    route: 'legal'
  }
];
