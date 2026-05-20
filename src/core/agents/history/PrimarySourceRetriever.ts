export class PrimarySourceRetriever {
  retrieve(query: string) {
    return { query, sources: ['Library of Congress', 'Europeana', 'Smithsonian collections where applicable'], note: 'Separate primary evidence from later secondary interpretation.' };
  }
}
