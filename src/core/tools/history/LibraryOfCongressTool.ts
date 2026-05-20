import axios from 'axios';
export class LibraryOfCongressTool {
  async search(query: string) {
    const response = await axios.get('https://www.loc.gov/search/', { params: { fo: 'json', q: query }, timeout: 10000 });
    return response.data;
  }
}
