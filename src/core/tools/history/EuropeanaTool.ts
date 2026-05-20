import axios from 'axios';
export class EuropeanaTool {
  private readonly apiKey = process.env.EUROPEANA_API_KEY;
  async search(query: string) {
    if (!this.apiKey) return { available: false, source: 'Europeana', note: 'Set EUROPEANA_API_KEY for live cultural heritage metadata.' };
    const response = await axios.get('https://api.europeana.eu/record/v2/search.json', { params: { wskey: this.apiKey, query }, timeout: 10000 });
    return response.data;
  }
}
