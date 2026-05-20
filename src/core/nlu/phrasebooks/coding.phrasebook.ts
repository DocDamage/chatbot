import { Phrasebook } from '../DomainPhrasebook';

export const codingPhrasebook: Phrasebook = [
  {
    phrases: ['this thing is buggin', 'find where it broke', 'why is this broken', 'fix this bug', 'track down the bug'],
    intent: 'debug_error',
    meaning: 'inspect code and diagnose a bug or regression',
    domain: 'coding',
    route: 'coding'
  },
  {
    phrases: ['make it work', 'wire this up', 'ship this feature', 'add the endpoint'],
    intent: 'write_feature',
    meaning: 'implement or connect code in the repository',
    domain: 'coding',
    route: 'coding'
  }
];
