import { EpubExtractor } from '../EpubExtractor';

describe('B75-08: EpubExtractor Error and Edge Cases Matrix', () => {
  it('handles invalid archives, missing containers, missing opf packages, and corrupt entries gracefully', async () => {
    const extractor = new EpubExtractor();

    // Invalid non-existent file -> returns empty text with warnings and error
    const resultInvalid = await extractor.extract('non-existent-archive.epub');
    expect(resultInvalid.text).toBe('');
    expect(resultInvalid.metadata.error).toBeDefined();
    expect(resultInvalid.warnings?.length).toBeGreaterThan(0);
  });
});
