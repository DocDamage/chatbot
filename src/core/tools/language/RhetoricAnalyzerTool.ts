export interface RhetoricInput {
  query?: string;
}

export class RhetoricAnalyzerTool {
  run(input: RhetoricInput = {}) {
    const query = input.query || '';
    const appeals = {
      ethos: /\b(experience|expert|trusted|record|credential)\b/i.test(query),
      pathos: /\b(feel|fear|hope|love|angry|urgent|imagine)\b/i.test(query),
      logos: /\b(data|because|therefore|evidence|reason|cost|benefit)\b/i.test(query)
    };

    return {
      domain: 'language',
      tool: 'RhetoricAnalyzerTool',
      appeals,
      argumentShape: this.argumentShape(query),
      strengths: [
        appeals.logos ? 'Uses reasons or evidence.' : 'Could add a clear reason or example.',
        appeals.ethos ? 'Builds credibility.' : 'Could name why the speaker/source is credible.',
        appeals.pathos ? 'Connects emotionally.' : 'Could add stakes without exaggeration.'
      ],
      ethicsCheck: 'Persuasion should stay truthful, reversible, and non-coercive.'
    };
  }

  private argumentShape(query: string): string {
    if (/\b(compare|versus|vs)\b/i.test(query)) return 'comparison';
    if (/\b(should|must|need to)\b/i.test(query)) return 'recommendation';
    if (/\b(because|therefore|so)\b/i.test(query)) return 'claim_with_reason';
    return 'informational';
  }
}
