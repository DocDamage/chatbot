export interface MapLookupInput {
  query?: string;
}

export class MapLookupTool {
  run(input: MapLookupInput = {}) {
    const query = input.query || '';
    const mapType = this.inferMapType(query);

    return {
      domain: 'geography',
      tool: 'MapLookupTool',
      mapType,
      spatialQuestions: this.questionsFor(mapType),
      contextLayers: [
        'physical geography',
        'political boundaries',
        'settlement and infrastructure',
        'climate/ecology',
        'historical boundary changes'
      ],
      contestedClaimWarning: /\b(border|territory|disputed|claimed|occupied)\b/i.test(query)
        ? 'This may involve contested or politically sensitive geography; use neutral wording and dated sources.'
        : undefined
    };
  }

  private inferMapType(query: string): string {
    if (/\b(border|territory|country|state|province)\b/i.test(query)) return 'political';
    if (/\b(mountain|river|desert|climate|coast|island)\b/i.test(query)) return 'physical';
    if (/\b(trade|route|migration|rail|port|city)\b/i.test(query)) return 'human_geography';
    return 'general_reference';
  }

  private questionsFor(mapType: string): string[] {
    if (mapType === 'political') return ['What jurisdiction is being discussed?', 'What date does the boundary claim refer to?', 'Is the boundary internationally recognized, contested, or administrative?'];
    if (mapType === 'physical') return ['What landform or water system matters?', 'How does terrain or climate shape settlement and movement?'];
    if (mapType === 'human_geography') return ['What flows through the place: people, goods, energy, language, or information?', 'What infrastructure or chokepoints matter?'];
    return ['Where is it?', 'What is nearby?', 'What scale is most useful: city, region, country, or world?'];
  }
}
