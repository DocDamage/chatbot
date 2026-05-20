import { Phrasebook } from '../DomainPhrasebook';

export const engineeringPhrasebook: Phrasebook = [
  {
    phrases: ['wire this circuit', 'what resistor', 'motor strong enough', 'robot arm', 'build a bom', 'beam load'],
    intent: 'engineering_design',
    meaning: 'electronics, mechanical, robotics, CAD, or maker planning',
    domain: 'engineering',
    route: 'engineering'
  }
];
