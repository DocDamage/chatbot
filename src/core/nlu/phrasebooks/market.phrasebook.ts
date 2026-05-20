import { Phrasebook } from '../DomainPhrasebook';

export const marketPhrasebook: Phrasebook = [
  {
    phrases: ['is nvda cooked', 'still got juice', 'stock cooked', 'calls expiring friday', 'all in'],
    intent: 'market_risk',
    meaning: 'analyze market risk, downside, uncertainty, and non-advice framing',
    domain: 'market',
    route: 'market'
  }
];
