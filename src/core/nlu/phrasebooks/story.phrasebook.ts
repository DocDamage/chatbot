import { Phrasebook } from '../DomainPhrasebook';

export const storyPhrasebook: Phrasebook = [
  {
    phrases: ['make this villain less corny', 'character feels flat', 'dialogue sounds fake', 'fix the lore', 'plot is weak'],
    intent: 'character.revision',
    meaning: 'revise character, plot, dialogue, or worldbuilding quality',
    domain: 'story',
    route: 'story'
  }
];
