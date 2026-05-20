export interface MarketGuardrailResult {
  allowed: boolean;
  answerType: 'analysis' | 'guardrailed';
  reasons: string[];
  requiredWarnings: string[];
}

export class MarketGuardrails {
  evaluate(input: string): MarketGuardrailResult {
    const text = input.toLowerCase();
    const reasons: string[] = [];

    if (/\b(all my money|life savings|all in|guaranteed|can't lose|sure thing)\b/.test(text)) {
      reasons.push('Request includes high-risk profit-certainty framing.');
    }

    if (/\b(calls?|puts?|options?|expiring|0dte|margin)\b/.test(text)) {
      reasons.push('Options and leveraged trades can lose most or all capital quickly.');
    }

    if (/\b(pump|dump|manipulate|coordinate buying)\b/.test(text)) {
      reasons.push('Market manipulation requests are not allowed.');
    }

    return {
      allowed: !/\b(pump|dump|manipulate|coordinate buying)\b/.test(text),
      answerType: reasons.length > 0 ? 'guardrailed' : 'analysis',
      reasons,
      requiredWarnings: [
        'I can analyze data, risks, valuation, filings, macro conditions, and scenarios.',
        'This is not financial advice and does not guarantee returns.'
      ]
    };
  }
}
