export class PopCultureIntentClassifier {
  classify(input: string) {
    const text = input.toLowerCase();
    if (text.includes('timeline')) return { kind: 'timeline', confidence: 0.9 };
    if (text.includes('franchise') || text.includes('marvel') || text.includes('phase')) return { kind: 'franchise', confidence: 0.85 };
    if (text.includes('compare')) return { kind: 'compare', confidence: 0.85 };
    if (text.includes('influenced') || text.includes('influence')) return { kind: 'influence_chain', confidence: 0.8 };
    return { kind: 'historical_pop_culture', confidence: 0.7 };
  }
}
