import { Phrasebook } from '../DomainPhrasebook';

export const businessPhrasebook: Phrasebook = [
  {
    phrases: ['will this business work', 'how should i price this', 'unit economics', 'is this idea viable', 'go to market'],
    intent: 'business_strategy',
    meaning: 'business model, pricing, product strategy, or unit economics',
    domain: 'business',
    route: 'business'
  }
];
