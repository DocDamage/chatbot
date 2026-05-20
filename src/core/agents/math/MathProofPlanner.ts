export class MathProofPlanner {
  plan(kind: string): string[] {
    if (kind === 'proof' || kind === 'logic') {
      return ['State assumptions', 'Translate claim formally', 'Search for counterexamples', 'Verify with Lean or Z3 when available', 'Explain proof obligations'];
    }
    return ['Classify problem', 'Compute a draft result', 'Verify symbolically or numerically', 'Check edge cases', 'Explain steps'];
  }
}
