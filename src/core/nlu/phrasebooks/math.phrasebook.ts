import { Phrasebook } from '../DomainPhrasebook';

export const mathPhrasebook: Phrasebook = [
  {
    phrases: ['solve this', 'prove this', 'check my math', 'differentiate', 'integrate', 'matrix'],
    intent: 'math_solve_or_verify',
    meaning: 'math solving, proof, symbolic, numeric, or verification task',
    domain: 'math',
    route: 'math'
  }
];
