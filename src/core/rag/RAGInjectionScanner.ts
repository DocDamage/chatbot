export interface RAGInjectionScanResult {
  safe: boolean;
  risk: 'low' | 'medium' | 'high';
  matches: string[];
}

export class RAGInjectionScanner {
  private static readonly patterns = [
    'ignore previous instructions',
    'ignore all previous instructions',
    'system prompt',
    'developer message',
    'reveal the system prompt',
    'exfiltrate',
    'api key',
    'password',
    'secret',
    'bypass safety',
    'jailbreak'
  ];

  static scan(content: string): RAGInjectionScanResult {
    const lower = content.toLowerCase();
    const matches = this.patterns.filter(pattern => lower.includes(pattern));
    const highRiskMatches = matches.filter(match =>
      ['ignore previous instructions', 'ignore all previous instructions', 'system prompt', 'developer message', 'exfiltrate', 'api key', 'password', 'secret'].includes(match)
    );

    return {
      safe: matches.length === 0,
      risk: highRiskMatches.length > 0 ? 'high' : matches.length > 0 ? 'medium' : 'low',
      matches
    };
  }
}
