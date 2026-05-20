import axios from 'axios';

export class OpenLibraryTool {
  async search(query: string) {
    const response = await axios.get('https://openlibrary.org/search.json', {
      params: { q: query, limit: 5 },
      timeout: 10000
    });
    return response.data;
  }
}
