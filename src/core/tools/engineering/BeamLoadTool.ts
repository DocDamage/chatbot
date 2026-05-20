export interface BeamLoadInput {
  query?: string;
  loadN?: number;
  spanM?: number;
}

export class BeamLoadTool {
  run(input: BeamLoadInput = {}) {
    const query = input.query || '';
    const loadN = input.loadN ?? this.extract(query, 'n') ?? this.extractKg(query);
    const spanM = input.spanM ?? this.extract(query, 'm');
    const maxMomentNm = loadN !== undefined && spanM !== undefined ? (loadN * spanM) / 4 : undefined;

    return {
      domain: 'engineering',
      tool: 'BeamLoadTool',
      case: 'simply supported beam with center point load',
      values: {
        loadNewtons: loadN,
        spanMeters: spanM,
        maxMomentNewtonMeters: maxMomentNm !== undefined ? Number(maxMomentNm.toFixed(3)) : undefined
      },
      warnings: [
        'This is a first-pass statics estimate, not a structural certification.',
        'Real design also needs material strength, section modulus, deflection, fasteners, fatigue, buckling, and safety factor.',
        'High-risk load-bearing designs need a qualified engineer.'
      ]
    };
  }

  private extract(query: string, unit: 'n' | 'm'): number | undefined {
    const patterns = {
      n: /\b(\d+(?:\.\d+)?)\s*(?:n|newton|newtons)\b/i,
      m: /\b(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/i
    };
    const match = query.match(patterns[unit]);
    return match ? Number(match[1]) : undefined;
  }

  private extractKg(query: string): number | undefined {
    const match = query.match(/\b(\d+(?:\.\d+)?)\s*kg\b/i);
    return match ? Number((Number(match[1]) * 9.81).toFixed(3)) : undefined;
  }
}
