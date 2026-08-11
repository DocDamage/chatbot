import { DocumentationRetriever } from './DocumentationRetriever';

describe('DocumentationRetriever', () => {
  it('prefers version-matched official documentation over learned snippets', () => {
    const results = new DocumentationRetriever().retrieve({ query: 'routing API', language: 'typescript', version: '5.3', entries: [
      { title: 'learned routing', content: 'routing API', source: 'interaction', authority: 'learned', language: 'typescript', version: '4.0' },
      { title: 'official routing', content: 'routing API', source: 'official', authority: 'official', language: 'typescript', version: '5.3' }
    ]});
    expect(results[0].label).toBe('official routing');
    expect(results[0].authority).toBe('official');
  });
});
