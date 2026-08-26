import { describe, expect, it, jest } from '@jest/globals';
import { ScientificPapersSource } from '../ScientificPapersSource';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-KNOW-002: ScientificPapersSource ArXiv, PubMed, and BioRxiv Suite', () => {
  it('checks availability and searches ArXiv research papers', async () => {
    (mockedAxios.get as any).mockImplementation(((async (url: string) => {
      if (url.includes('arxiv.org')) {
        return {
          data: `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.15884</id>
    <title>Corrective Retrieval Augmented Generation</title>
    <summary>CRAG introduces self-correction on retrieval results.</summary>
    <author><name>Shi-Qi Yan</name></author>
    <published>2024-01-28T00:00:00Z</published>
  </entry>
</feed>`
        };
      }
      return { data: {} };
    }) as any));

    const source = new ScientificPapersSource('arxiv');
    const available = await source.isAvailable();
    expect(available).toBe(true);

    const results = await source.search('CRAG retrieval', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Corrective Retrieval Augmented Generation');

    const paper = await source.getById('arxiv_2401.15884');
    expect(paper).not.toBeNull();
    expect(paper?.title).toBe('Corrective Retrieval Augmented Generation');
  });

  it('searches PubMed and fetches paper by ID', async () => {
    (mockedAxios.get as any).mockImplementation(((async (url: string) => {
      if (url.includes('esearch.fcgi')) {
        return {
          data: {
            esearchresult: {
              idlist: ['12345678']
            }
          }
        };
      }
      if (url.includes('esummary.fcgi')) {
        return {
          data: {
            result: {
              '12345678': {
                title: 'CRISPR Gene Editing Advances',
                authors: [{ name: 'Jennifer Doudna' }],
                abstract: 'Comprehensive review of CRISPR mechanisms.',
                source: 'Nature',
                pubdate: '2023-05-12'
              }
            }
          }
        };
      }
      return { data: {} };
    }) as any));

    const source = new ScientificPapersSource('pubmed');
    const results = await source.search('CRISPR gene editing', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('CRISPR Gene Editing Advances');

    const byId = await source.getById('pubmed_12345678');
    expect(byId).not.toBeNull();
    expect(byId?.title).toBe('CRISPR Gene Editing Advances');
  });

  it('searches BioRxiv preprints', async () => {
    (mockedAxios.get as any).mockImplementation(((async (url: string) => {
      if (url.includes('biorxiv.org')) {
        return {
          data: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>Novel Protein Folding Algorithms</title>
      <description>Deep learning for structural biology.</description>
      <link>https://www.biorxiv.org/content/10.1101/2024.01.01.123456v1</link>
      <dc:identifier>doi:10.1101/2024.01.01.123456</dc:identifier>
      <dc:creator>John Doe</dc:creator>
    </item>
  </channel>
</rss>`
        };
      }
      return { data: {} };
    }) as any));

    const source = new ScientificPapersSource('biorxiv');
    const results = await source.search('Protein folding', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Novel Protein Folding Algorithms');
  });
});
