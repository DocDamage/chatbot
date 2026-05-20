export interface DemographicsInput {
  query?: string;
}

export class DemographicsTool {
  run(input: DemographicsInput = {}) {
    const query = input.query || '';

    return {
      domain: 'geography',
      tool: 'DemographicsTool',
      requestedDimensions: this.dimensions(query),
      analysisFrame: [
        'Use a dated source and define geography precisely.',
        'Separate population count, density, age structure, migration, language, religion, education, income, and urbanization.',
        'Avoid treating demographics as destiny; connect data to institutions, economics, geography, and history.'
      ],
      caveats: [
        'Census categories vary by country and era.',
        'Ethnicity, race, religion, and language categories are socially and politically shaped.'
      ]
    };
  }

  private dimensions(query: string): string[] {
    const dimensions: string[] = [];
    if (/\b(population|people|populous)\b/i.test(query)) dimensions.push('population');
    if (/\b(age|young|old|median)\b/i.test(query)) dimensions.push('age_structure');
    if (/\b(language|speak)\b/i.test(query)) dimensions.push('language');
    if (/\b(religion|faith)\b/i.test(query)) dimensions.push('religion');
    if (/\b(migration|immigration|diaspora)\b/i.test(query)) dimensions.push('migration');
    if (/\b(city|urban|rural)\b/i.test(query)) dimensions.push('urbanization');
    return dimensions.length ? dimensions : ['population', 'urbanization', 'language', 'age_structure'];
  }
}
