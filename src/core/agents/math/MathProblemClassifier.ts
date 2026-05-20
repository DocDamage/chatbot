export type MathProblemKind = 'algebra' | 'calculus' | 'proof' | 'probability' | 'stats' | 'optimization' | 'geometry' | 'logic' | 'linear_algebra' | 'numeric';

export class MathProblemClassifier {
  classify(input: string): { kind: MathProblemKind; confidence: number } {
    const lower = input.toLowerCase();
    if (lower.includes('differentiate') || lower.includes('derivative') || lower.includes('integral') || lower.includes('limit')) return { kind: 'calculus', confidence: 0.95 };
    if (lower.includes('prove') || lower.includes('theorem')) return { kind: 'proof', confidence: 0.9 };
    if (lower.includes('probability') || lower.includes('expected value')) return { kind: 'probability', confidence: 0.85 };
    if (lower.includes('matrix') || lower.includes('eigen')) return { kind: 'linear_algebra', confidence: 0.85 };
    if (lower.includes('optimize') || lower.includes('minimize') || lower.includes('maximize')) return { kind: 'optimization', confidence: 0.85 };
    if (lower.includes('satisfy') || lower.includes('logic') || lower.includes('constraint')) return { kind: 'logic', confidence: 0.8 };
    if (lower.includes('numeric') || lower.includes('approx')) return { kind: 'numeric', confidence: 0.75 };
    return { kind: 'algebra', confidence: 0.65 };
  }
}
