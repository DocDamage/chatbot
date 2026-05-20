import { HumanLanguageRoute } from './HumanLanguageRouter';

export class ClarifyingQuestionBuilder {
  build(route: Pick<HumanLanguageRoute, 'normalizedQuery' | 'candidateDomains'>): string {
    if (route.normalizedQuery.toLowerCase().includes('logic')) {
      return 'When you say “logic,” do you mean Logic Pro, philosophy/logic, or general reasoning?';
    }

    if (route.candidateDomains.includes('music') && route.candidateDomains.includes('gamedev')) {
      return 'Do you mean music/audio impact or game feel/combat impact?';
    }

    return 'Do you want this handled as a specialist task or a general question?';
  }
}
