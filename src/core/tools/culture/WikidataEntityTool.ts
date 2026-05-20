import axios from 'axios';

export class WikidataEntityTool {
  async search(query: string) {
    const response = await axios.get('https://www.wikidata.org/w/api.php', {
      params: { action: 'wbsearchentities', search: query, language: 'en', format: 'json', limit: 5 },
      timeout: 10000
    });
    return response.data;
  }
}
