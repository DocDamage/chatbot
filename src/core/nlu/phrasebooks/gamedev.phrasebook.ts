import { Phrasebook } from '../DomainPhrasebook';

export const gamedevPhrasebook: Phrasebook = [
  {
    phrases: ['combat feels weak', 'make the hit feel better', 'game feel', 'jump feels floaty', 'enemy too tanky'],
    intent: 'game_design.balance_or_feel',
    meaning: 'improve game feel, combat tuning, physics, or balance',
    domain: 'gamedev',
    route: 'gamedev'
  }
];
