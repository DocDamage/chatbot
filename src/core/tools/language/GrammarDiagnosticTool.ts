export interface GrammarInput {
  query?: string;
  text?: string;
}

export class GrammarDiagnosticTool {
  run(input: GrammarInput = {}) {
    const text = input.text || input.query || '';
    const issues = [
      ...this.findDoubleSpaces(text),
      ...this.findCommonConfusions(text),
      ...this.findCapitalization(text)
    ];

    return {
      domain: 'language',
      tool: 'GrammarDiagnosticTool',
      issueCount: issues.length,
      issues,
      proofreadingChecklist: [
        'Check subject-verb agreement.',
        'Check tense consistency.',
        'Check punctuation around clauses.',
        'Read once for meaning and once for mechanics.'
      ]
    };
  }

  private findDoubleSpaces(text: string): string[] {
    return /\s{2,}/.test(text) ? ['Multiple spaces detected; collapse them to one.'] : [];
  }

  private findCommonConfusions(text: string): string[] {
    const issues: string[] = [];
    if (/\byour welcome\b/i.test(text)) issues.push('Use "you are welcome" or "you\'re welcome" instead of "your welcome."');
    if (/\bits\s+a\s+\w+\s+that\s+it's\b/i.test(text)) issues.push('Check "its" vs "it\'s" for possession vs contraction.');
    if (/\bthere going\b/i.test(text)) issues.push('Use "they are/they\'re going" when referring to people.');
    return issues;
  }

  private findCapitalization(text: string): string[] {
    return /^[a-z]/.test(text.trim()) ? ['Start the sentence with a capital letter.'] : [];
  }
}
