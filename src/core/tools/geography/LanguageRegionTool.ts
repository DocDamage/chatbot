export interface LanguageRegionInput {
  query?: string;
}

const languageRegions: Record<string, string[]> = {
  spanish: ['Spain', 'Mexico', 'Central America', 'much of South America', 'Caribbean communities', 'diaspora communities worldwide'],
  arabic: ['North Africa', 'the Levant', 'the Arabian Peninsula', 'parts of East Africa', 'diaspora communities worldwide'],
  french: ['France', 'parts of Belgium and Switzerland', 'Quebec', 'West and Central Africa', 'Caribbean and Pacific regions'],
  hindi: ['northern and central India', 'Indian diaspora communities'],
  english: ['United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand', 'Ireland', 'many multilingual postcolonial contexts']
};

export class LanguageRegionTool {
  run(input: LanguageRegionInput = {}) {
    const query = input.query || '';
    const language = this.detectLanguage(query);

    return {
      domain: 'geography',
      tool: 'LanguageRegionTool',
      language: language || 'unknown',
      regions: language ? languageRegions[language] : [],
      notes: [
        'Official language, home language, second language, and prestige language can differ.',
        'Dialects and language varieties are not lesser versions; name them respectfully when relevant.'
      ]
    };
  }

  private detectLanguage(query: string): string | undefined {
    const text = query.toLowerCase();
    return Object.keys(languageRegions).find(language => text.includes(language));
  }
}
