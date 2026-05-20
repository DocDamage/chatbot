export class ScienceIntentClassifier {
  classify(input: string) {
    const text = input.toLowerCase();
    if (text.includes('patent')) return { kind: 'patent_lookup', confidence: 0.9 };
    if (text.includes('paper') || text.includes('study')) return { kind: 'paper_summary', confidence: 0.85 };
    if (text.includes('timeline')) return { kind: 'scientific_timeline', confidence: 0.85 };
    if (text.includes('invention') || text.includes('inventor') || text.includes('wheel')) return { kind: 'explain_invention', confidence: 0.9 };
    if (text.includes('theory')) return { kind: 'theory_evolution', confidence: 0.8 };
    return { kind: 'science_context', confidence: 0.7 };
  }
}
