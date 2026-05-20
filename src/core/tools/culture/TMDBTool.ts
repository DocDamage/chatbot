import axios from 'axios';

export class TMDBTool {
  private readonly apiKey = process.env.TMDB_API_KEY;
  async search(query: string) {
    if (!this.apiKey) return { available: false, source: 'TMDB', note: 'Set TMDB_API_KEY for live film/TV metadata.' };
    const response = await axios.get('https://api.themoviedb.org/3/search/multi', {
      params: { api_key: this.apiKey, query },
      timeout: 10000
    });
    return response.data;
  }
}
