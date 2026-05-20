export class JurisdictionRouterTool {
  run(input: Record<string, any> = {}) {
    const query = String(input.query || '');
    const jurisdiction = this.detectJurisdiction(query);
    return {
      domain: 'legal',
      tool: 'JurisdictionRouterTool',
      jurisdiction,
      confidence: jurisdiction === 'unknown' ? 0.2 : 0.75,
      required: jurisdiction === 'unknown'
        ? 'Ask for country/state/city before specific legal analysis.'
        : 'Verify current law in the named jurisdiction before relying on this.',
      routing: [
        'Federal/national law may set baseline rules.',
        'State/provincial/local law may change rights, deadlines, forms, and remedies.',
        'Contracts may select governing law and venue separately.'
      ]
    };
  }

  private detectJurisdiction(query: string): string {
    const text = query.toLowerCase();
    if (/\bcalifornia| ca\b/.test(text)) return 'California, United States';
    if (/\bnew york| ny\b/.test(text)) return 'New York, United States';
    if (/\bflorida| fl\b/.test(text)) return 'Florida, United States';
    if (/\btexas| tx\b/.test(text)) return 'Texas, United States';
    if (/\bunited states| usa| u\.s\.\b/.test(text)) return 'United States';
    if (/\buk|united kingdom|england\b/.test(text)) return 'United Kingdom / England and Wales';
    if (/\bcanada\b/.test(text)) return 'Canada';
    if (/\beu|european union\b/.test(text)) return 'European Union';
    return 'unknown';
  }
}
