export class AwardLookupTool {
  lookup(query: string) {
    return { query, source: 'Wikidata/TMDB metadata spine', note: 'Award data should be resolved to cited metadata sources before firm claims.' };
  }
}
