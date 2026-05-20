export class HistoryIntentClassifier {
  classify(input: string) {
    const text = input.toLowerCase();
    if (text.includes('timeline')) return { kind: 'timeline', confidence: 0.9 };
    if (text.includes('compare')) return { kind: 'compare_civilizations', confidence: 0.85 };
    if (text.includes('primary source')) return { kind: 'primary_source_explanation', confidence: 0.85 };
    if (text.includes('why') || text.includes('cause')) return { kind: 'cause_effect', confidence: 0.8 };
    return { kind: 'historical_context', confidence: 0.7 };
  }
}
