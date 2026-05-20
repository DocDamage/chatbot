export interface FallacyDetectionInput {
  query?: string;
}

const fallacyRules = [
  { pattern: /\beveryone knows|everybody knows|obviously\b/i, label: 'appeal_to_common_belief', check: 'Popularity or obviousness is not evidence by itself.' },
  { pattern: /\byou're stupid|you are stupid|idiot|moron\b/i, label: 'ad_hominem_risk', check: 'Attacking a person can distract from whether the claim is true.' },
  { pattern: /\balways|never|all of them|none of them\b/i, label: 'overgeneralization_risk', check: 'Universal claims need strong support and clear exceptions.' },
  { pattern: /\bif we allow.*then.*(destroy|collapse|everyone will)\b/i, label: 'slippery_slope_risk', check: 'Show the causal chain instead of assuming escalation.' },
  { pattern: /\bchoose between|only two options|either.*or\b/i, label: 'false_dilemma_risk', check: 'Check whether more than two options exist.' }
];

export class FallacyDetectionTool {
  run(input: FallacyDetectionInput = {}) {
    const query = input.query || '';
    const matches = fallacyRules
      .filter(rule => rule.pattern.test(query))
      .map(rule => ({ label: rule.label, reasoningCheck: rule.check }));

    return {
      domain: 'philosophy',
      tool: 'FallacyDetectionTool',
      possibleFallacies: matches,
      caution: 'These are possible reasoning risks, not automatic refutations. Reconstruct the strongest fair version before criticizing it.',
      nextStep: matches.length > 0
        ? 'Rewrite the argument with clearer evidence and fewer rhetorical shortcuts.'
        : 'No obvious simple fallacy pattern detected; inspect validity, soundness, ambiguity, and evidence quality.'
    };
  }
}
