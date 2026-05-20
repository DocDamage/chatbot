export class ContractClauseExplainerTool {
  run(input: Record<string, any> = {}) {
    const text = String(input.text || input.query || '');
    const clauseType = this.classifyClause(text);
    return {
      domain: 'legal',
      tool: 'ContractClauseExplainerTool',
      clauseType,
      plainEnglish: this.plainEnglish(clauseType),
      watchFor: [
        'One-sided discretion or undefined standards.',
        'Hidden deadlines, auto-renewals, or notice requirements.',
        'Fees, indemnity, liability caps, and dispute venue.',
        'Rights that survive termination.',
        'Terms that conflict with the main business deal.'
      ],
      questions: [
        'Who can trigger this clause?',
        'What happens if a party breaches it?',
        'Is the obligation mutual or one-sided?',
        'What dates, amounts, and exceptions are missing?'
      ],
      disclaimer: 'Contract explanation, not legal advice.'
    };
  }

  private classifyClause(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('indemn')) return 'indemnification';
    if (lower.includes('liability') || lower.includes('damages')) return 'limitation of liability';
    if (lower.includes('non-compete') || lower.includes('noncompete')) return 'non-compete';
    if (lower.includes('confidential')) return 'confidentiality';
    if (lower.includes('terminate') || lower.includes('termination')) return 'termination';
    if (lower.includes('governing law') || lower.includes('venue')) return 'governing law / venue';
    return 'general contract clause';
  }

  private plainEnglish(clauseType: string): string {
    const explanations: Record<string, string> = {
      indemnification: 'One side may have to cover losses, claims, or costs caused by specified events.',
      'limitation of liability': 'The contract may cap or exclude certain damages if something goes wrong.',
      'non-compete': 'A party may be restricted from working in a competing business, often heavily dependent on jurisdiction.',
      confidentiality: 'A party must protect specified non-public information and limit disclosure/use.',
      termination: 'This explains when and how the agreement can end and what obligations continue.',
      'governing law / venue': 'This chooses which law applies and where disputes may be handled.',
      'general contract clause': 'This clause creates rights, duties, limits, or procedures that need context from the full contract.'
    };
    return explanations[clauseType];
  }
}
