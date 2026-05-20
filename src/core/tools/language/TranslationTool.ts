export interface TranslationInput {
  query?: string;
  text?: string;
  targetLanguage?: string;
}

const phrasebook: Record<string, Record<string, string>> = {
  spanish: {
    hello: 'hola',
    'thank you': 'gracias',
    'good morning': 'buenos dias',
    'how are you': 'como estas',
    goodbye: 'adios'
  },
  french: {
    hello: 'bonjour',
    'thank you': 'merci',
    'good morning': 'bonjour',
    goodbye: 'au revoir'
  }
};

export class TranslationTool {
  run(input: TranslationInput = {}) {
    const query = input.query || input.text || '';
    const targetLanguage = input.targetLanguage || this.inferTarget(query);
    const quoted = query.match(/["']([^"']+)["']/)?.[1];
    const sourceText = input.text || quoted || query.replace(/translate|to spanish|to french|to english/gi, '').trim();
    const normalized = sourceText.toLowerCase().replace(/[?.!]/g, '').trim();
    const direct = phrasebook[targetLanguage]?.[normalized];

    return {
      domain: 'language',
      tool: 'TranslationTool',
      targetLanguage,
      sourceText,
      translation: direct || undefined,
      guidance: direct
        ? 'Matched a deterministic phrasebook translation.'
        : 'No deterministic phrasebook match was available. Use a model or bilingual source for a full translation, and preserve tone, idioms, names, and cultural context.',
      nuanceChecks: [
        'Identify formal vs informal register.',
        'Preserve names, numbers, dates, and units.',
        'Flag idioms that should be localized instead of translated word-for-word.'
      ]
    };
  }

  private inferTarget(query: string): string {
    if (/\bspanish|espanol\b/i.test(query)) return 'spanish';
    if (/\bfrench|francais\b/i.test(query)) return 'french';
    if (/\benglish\b/i.test(query)) return 'english';
    return 'unknown';
  }
}
