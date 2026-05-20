import { Phrasebook } from '../DomainPhrasebook';

export const gamingPhrasebook: Phrasebook = [
  {
    phrases: ['speedrun route', 'any percent route', 'glitchless run', 'routing a metroidvania'],
    intent: 'gaming.speedrunning',
    meaning: 'speedrunning strategy, routing, rules, or optimization',
    domain: 'gaming',
    route: 'gaming'
  },
  {
    phrases: ['game lore', 'canon ending', 'franchise timeline', 'character backstory'],
    intent: 'gaming.lore',
    meaning: 'game lore, canon, timelines, and franchise questions',
    domain: 'gaming',
    route: 'gaming'
  },
  {
    phrases: ['modding tools', 'rom hacking', 'save editor', 'emulation settings'],
    intent: 'gaming.modding',
    meaning: 'modding, emulation concepts, and save editing workflows',
    domain: 'gaming',
    route: 'gaming'
  }
];
