export class NewsEventTool {
  async latest(symbol: string) {
    return {
      symbol: symbol.toUpperCase(),
      available: false,
      source: 'news provider not configured',
      note: 'Connect a news provider before treating sentiment or events as current.'
    };
  }
}
