import axios from 'axios';
export class OpenAlexTool {
  async works(query: string) {
    const response = await axios.get('https://api.openalex.org/works', { params: { search: query, per_page: 5 }, timeout: 10000 });
    return response.data;
  }
}
