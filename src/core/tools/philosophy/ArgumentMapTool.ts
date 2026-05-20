export interface ArgumentMapInput {
  query?: string;
}

export class ArgumentMapTool {
  run(input: ArgumentMapInput = {}) {
    const query = input.query || '';
    const claim = this.extractClaim(query);

    return {
      domain: 'philosophy',
      tool: 'ArgumentMapTool',
      claim,
      argumentType: this.argumentType(query),
      reasons: this.extractReasons(query),
      hiddenAssumptions: [
        'Key terms are being used consistently.',
        'The evidence actually supports the conclusion.',
        'No relevant exception changes the conclusion.'
      ],
      pressureTests: [
        'What would count as evidence against the claim?',
        'Is the claim descriptive, normative, or both?',
        'Does the conclusion follow from the reasons, or is an extra premise needed?'
      ]
    };
  }

  private extractClaim(query: string): string {
    const match = query.match(/\b(?:argue|claim|thesis|that)\s+(.+)/i);
    return (match?.[1] || query).trim();
  }

  private extractReasons(query: string): string[] {
    const because = query.match(/\bbecause\s+(.+)/i)?.[1];
    if (because) return because.split(/\band\b|,|;/).map(part => part.trim()).filter(Boolean);
    return ['No explicit reason marker found; ask for premises or evidence.'];
  }

  private argumentType(query: string): string {
    if (/\b(should|ought|must|right|wrong|moral|ethical)\b/i.test(query)) return 'normative';
    if (/\b(causes|leads to|because|evidence|data)\b/i.test(query)) return 'empirical';
    if (/\b(definition|means|is a kind of)\b/i.test(query)) return 'conceptual';
    return 'mixed_or_unclear';
  }
}
