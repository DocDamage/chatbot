import axios from 'axios';
export class GBIFTool {
  async species(query: string) {
    const response = await axios.get('https://api.gbif.org/v1/species/search', { params: { q: query, limit: 5 }, timeout: 10000 });
    return response.data;
  }
}
