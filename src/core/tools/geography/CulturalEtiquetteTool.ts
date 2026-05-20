export interface CulturalEtiquetteInput {
  query?: string;
}

export class CulturalEtiquetteTool {
  run(input: CulturalEtiquetteInput = {}) {
    const query = input.query || '';

    return {
      domain: 'geography',
      tool: 'CulturalEtiquetteTool',
      context: this.context(query),
      guidance: [
        'Ask about local norms without assuming one practice represents everyone.',
        'Observe formality, greetings, gift-giving, punctuality, dress, religious spaces, and photography norms.',
        'When unsure, be modest, ask permission, and let the local host or institution set expectations.'
      ],
      antiStereotypeRules: [
        'Describe practices as contextual, not innate traits.',
        'Separate law, religion, class, region, age, ethnicity, and personal preference.',
        'Avoid ranking cultures as advanced/backward, polite/rude, or modern/traditional.'
      ]
    };
  }

  private context(query: string): string {
    if (/\b(business|meeting|work)\b/i.test(query)) return 'business_etiquette';
    if (/\b(travel|visit|tourist)\b/i.test(query)) return 'travel_etiquette';
    if (/\b(food|meal|dinner)\b/i.test(query)) return 'meal_etiquette';
    if (/\b(religion|temple|church|mosque|shrine)\b/i.test(query)) return 'religious_site_etiquette';
    return 'general_cultural_context';
  }
}
