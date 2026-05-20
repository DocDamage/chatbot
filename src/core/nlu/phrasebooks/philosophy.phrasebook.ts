import { Phrasebook } from '../DomainPhrasebook';

export const philosophyPhrasebook: Phrasebook = [
  {
    phrases: ['is this argument bad', 'what fallacy is this', 'debate me', 'ethical dilemma', 'logic problem'],
    intent: 'argument_analysis',
    meaning: 'argument mapping, fallacy detection, debate, ethics, or philosophical logic',
    domain: 'philosophy',
    route: 'philosophy'
  }
];
