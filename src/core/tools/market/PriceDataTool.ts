export class PriceDataTool {
  async quote(symbol: string) {
    return {
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      source: process.env.POLYGON_API_KEY ? 'Polygon/Massive API' : 'not configured',
      available: !!process.env.POLYGON_API_KEY,
      note: process.env.POLYGON_API_KEY ? 'Price provider configured.' : 'Set POLYGON_API_KEY for live market prices.'
    };
  }
}
