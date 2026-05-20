import { Phrasebook } from '../DomainPhrasebook';

export const healthPhrasebook: Phrasebook = [
  {
    phrases: ['should i be worried about this pain', 'is this symptom bad', 'my chest hurts', 'can i mix these meds'],
    intent: 'health_triage',
    meaning: 'health question requiring red-flag and clinician guardrails',
    domain: 'health',
    route: 'health'
  }
];
