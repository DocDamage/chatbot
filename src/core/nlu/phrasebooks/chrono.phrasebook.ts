import { Phrasebook } from '../DomainPhrasebook';

export const chronoPhrasebook: Phrasebook = [
  {
    phrases: ['what happened in', 'what do you know about', 'back in', 'bc', 'bce', 'ancient', 'prehistoric'],
    intent: 'temporal_knowledge',
    meaning: 'time-aware history, science, culture, or event retrieval',
    domain: 'history',
    route: 'history',
    confidence: 0.74
  },
  {
    phrases: ['who invented', 'when was invented', 'discovery timeline', 'patent history'],
    intent: 'science_timeline',
    meaning: 'science, invention, discovery, patent, or technology timeline',
    domain: 'science',
    route: 'science'
  },
  {
    phrases: ['pop culture reference', 'what was popular', 'biggest movie', 'biggest song'],
    intent: 'pop_culture_timeline',
    meaning: 'pop culture timeline or contextual reference',
    domain: 'pop_culture',
    route: 'pop_culture'
  }
];
