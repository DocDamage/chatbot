export class PopCultureSourceRouter {
  route(query: string) {
    const text = query.toLowerCase();
    if (text.includes('film') || text.includes('tv') || text.includes('movie')) return ['TMDB', 'Wikidata'];
    if (text.includes('music') || text.includes('album') || text.includes('hip-hop')) return ['MusicBrainz', 'Wikidata'];
    if (text.includes('book') || text.includes('novel')) return ['Open Library', 'Wikidata'];
    return ['Wikidata', 'Wikimedia'];
  }
}
