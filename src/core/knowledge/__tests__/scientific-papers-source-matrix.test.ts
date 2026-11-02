import axios from 'axios';
import { ScientificPapersSource } from '../ScientificPapersSource';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('B75-03: ScientificPapersSource Decision Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isAvailable handles online check', async () => {
    const source = new ScientificPapersSource();

    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    expect(await source.isAvailable()).toBe(true);

    mockedAxios.get.mockRejectedValueOnce(new Error('Network offline'));
    expect(await source.isAvailable()).toBe(false);
  });

  it('searches ArXiv, PubMed, and BioRxiv with XML and JSON parsing', async () => {
    const source = new ScientificPapersSource('all');

    // 1. ArXiv XML response
    const arxivXml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>http://arxiv.org/abs/2301.00001v1</id>
          <title>Deep Learning in Quantum Physics</title>
          <summary>We explore deep neural networks for Hamiltonian reconstruction.</summary>
          <published>2023-01-01T00:00:00Z</published>
          <author><name>Alice Smith</name></author>
          <author><name>Bob Jones</name></author>
        </entry>
      </feed>
    `;

    // 2. PubMed search + summary response
    const pubmedSearchJson = {
      esearchresult: { idlist: ['12345678'] }
    };
    const pubmedSummaryJson = {
      result: {
        '12345678': {
          title: 'Genomic editing advances',
          pubdate: '2024-02-15',
          authors: [{ name: 'Carol White' }],
          source: 'Nature',
          uid: '12345678'
        }
      }
    };

    // 3. BioRxiv RSS XML response
    const biorxivRssXml = `
      <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel>
          <item>
            <title>Single-cell sequencing of neural tissue</title>
            <description>Detailed transcriptomics across developmental stages.</description>
            <link>https://www.biorxiv.org/content/10.1101/2024.01.01.123456</link>
            <dc:identifier>doi:10.1101/2024.01.01.123456</dc:identifier>
            <dc:creator>David Brown</dc:creator>
            <dc:creator>Eve Taylor</dc:creator>
          </item>
        </channel>
      </rss>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({ data: arxivXml }) // ArXiv
      .mockResolvedValueOnce({ data: pubmedSearchJson }) // PubMed esearch
      .mockResolvedValueOnce({ data: pubmedSummaryJson }) // PubMed esummary
      .mockResolvedValueOnce({ data: biorxivRssXml }); // BioRxiv RSS

    const results = await source.search('quantum genomic', { limit: 10 });
    expect(results.length).toBe(3);
    expect(results[0].source).toBe('arxiv');
    expect(results[0].title).toBe('Deep Learning in Quantum Physics');
    expect(results[1].source).toBe('pubmed');
    expect(results[2].source).toBe('biorxiv');
  });

  it('getById fetches papers by specific repository ID', async () => {
    const source = new ScientificPapersSource();

    // ArXiv by ID
    const arxivXml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>http://arxiv.org/abs/2301.00001v1</id>
          <title>ArXiv Single Paper</title>
          <summary>Abstract of the single paper.</summary>
          <author><name>Researcher</name></author>
        </entry>
      </feed>
    `;
    mockedAxios.get.mockResolvedValueOnce({ data: arxivXml });
    const arxivPaper = await source.getById('arxiv_2301.00001');
    expect(arxivPaper?.title).toBe('ArXiv Single Paper');

    // PubMed by ID
    const pubmedSummaryJson = {
      result: {
        '87654321': {
          title: 'PubMed Single Paper',
          pubdate: '2023-08-01',
          authors: [{ name: 'Dr. Bio' }],
          source: 'Science'
        }
      }
    };
    mockedAxios.get.mockResolvedValueOnce({ data: pubmedSummaryJson });
    const pubmedPaper = await source.getById('pubmed_87654321');
    expect(pubmedPaper?.title).toBe('PubMed Single Paper');

    // BioRxiv by ID
    const biorxivJson = {
      collection: [
        {
          title: 'BioRxiv Single Paper',
          abstract: 'BioRxiv abstract here.',
          authors: 'Author BioRxiv',
          doi: '10.1101/2023.09.01.999999',
          date: '2023-09-01'
        }
      ]
    };
    mockedAxios.get.mockResolvedValueOnce({ data: biorxivJson });
    const bioPaper = await source.getById('biorxiv_10.1101/2023.09.01.999999');
    expect(bioPaper?.title).toBe('BioRxiv Single Paper');

    // BioRxiv fallback when paper not in collection
    mockedAxios.get.mockResolvedValueOnce({ data: { collection: [] } });
    const bioFallback = await source.getById('biorxiv_missing_doi');
    expect(bioFallback?.title).toContain('BioRxiv Paper');

    // Unknown ID prefix
    const unknownPaper = await source.getById('unknown_123');
    expect(unknownPaper).toBeNull();
  });
});
