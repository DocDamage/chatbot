import axios from 'axios';

export class MusicBrainzTool {
  async search(query: string) {
    const response = await axios.get('https://musicbrainz.org/ws/2/artist', {
      params: { query, fmt: 'json', limit: 5 },
      headers: { 'User-Agent': 'ChatBot/1.0 (https://github.com/DocDamage/chatbot)' },
      timeout: 10000
    });
    return response.data;
  }
}
