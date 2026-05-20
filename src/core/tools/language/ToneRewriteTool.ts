export interface ToneRewriteInput {
  query?: string;
  text?: string;
  tone?: string;
}

export class ToneRewriteTool {
  run(input: ToneRewriteInput = {}) {
    const query = input.query || input.text || '';
    const tone = input.tone || this.inferTone(query);
    const sourceText = input.text || query.match(/["']([^"']+)["']/)?.[1] || query;

    return {
      domain: 'language',
      tool: 'ToneRewriteTool',
      tone,
      before: sourceText,
      rewritePlan: this.planFor(tone),
      rewrittenExample: this.rewriteExample(sourceText, tone),
      preservationChecks: [
        'Keep the same request or claim.',
        'Remove unnecessary blame or filler.',
        'Keep commitments, deadlines, and constraints explicit.'
      ]
    };
  }

  private inferTone(query: string): string {
    if (/\b(professional|polite|work|email)\b/i.test(query)) return 'professional';
    if (/\b(friendly|warm|casual)\b/i.test(query)) return 'friendly';
    if (/\b(firm|direct|assertive)\b/i.test(query)) return 'firm';
    if (/\b(shorter|concise|brief)\b/i.test(query)) return 'concise';
    return 'clear';
  }

  private planFor(tone: string): string[] {
    const plans: Record<string, string[]> = {
      professional: ['Lead with context.', 'State the request clearly.', 'Close with a polite next step.'],
      friendly: ['Use warm phrasing.', 'Keep the ask simple.', 'Avoid overexplaining.'],
      firm: ['State the boundary.', 'Name the required action.', 'Avoid apology language.'],
      concise: ['Cut setup.', 'Use one ask per sentence.', 'Prefer active verbs.'],
      clear: ['Make the main point first.', 'Use concrete nouns and verbs.', 'Remove ambiguous pronouns.']
    };
    return plans[tone] || plans.clear;
  }

  private rewriteExample(text: string, tone: string): string {
    const cleaned = text.replace(/\b(rewrite|make this|more professional|more polite|more concise)\b/gi, '').trim();
    if (!cleaned || cleaned === text) return 'Provide the exact text to rewrite, and I will preserve the meaning while changing the tone.';
    if (tone === 'professional') return `Professional version: ${cleaned}`;
    if (tone === 'firm') return `Firm version: ${cleaned}`;
    if (tone === 'concise') return `Concise version: ${cleaned.split(/[.!?]/)[0].trim()}.`;
    return `Rewritten version: ${cleaned}`;
  }
}
