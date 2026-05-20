import axios from 'axios';
export class SmithsonianTool {
  private readonly apiKey = process.env.SMITHSONIAN_API_KEY;
  async search(query: string) {
    if (!this.apiKey) return { available: false, source: 'Smithsonian Open Access', note: 'Set SMITHSONIAN_API_KEY for live collection lookup.' };
    const response = await axios.get('https://api.si.edu/openaccess/api/v1.0/search', { params: { api_key: this.apiKey, q: query }, timeout: 10000 });
    return response.data;
  }
}
