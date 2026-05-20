import { Phrasebook } from '../DomainPhrasebook';

export const securityPhrasebook: Phrasebook = [
  {
    phrases: ['is this app safe', 'check for secrets', 'lock this down', 'threat model this', 'is auth broken'],
    intent: 'security_review',
    meaning: 'defensive security, privacy, auth, or dependency review',
    domain: 'security',
    route: 'security'
  }
];
